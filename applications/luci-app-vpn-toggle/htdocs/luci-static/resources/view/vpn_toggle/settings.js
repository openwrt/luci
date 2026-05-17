'use strict';
'require view';
'require uci';
'require ui';
'require fs';

return view.extend({

load: function() {
  return Promise.all([
    uci.load('vpn_toggle'),
    uci.load('pbr'),
    uci.load('network'),
    uci.load('dhcp'),
    fs.read('/var/dhcp.leases').catch(function(){ return ''; }),
    fs.read('/proc/net/arp').catch(function(){ return ''; }),
    uci.load('firewall').catch(function(){ return null; })
  ]);
},

/* ── helpers ─────────────────────────────────────────────── */

_save: function() {
  return uci.save();
},

_ifaces: function() {
  var r = [];
  uci.sections('network', 'interface', function(s) {
    if (s['.name'] !== 'loopback') r.push(s['.name']);
  });
  return r;
},

_subnets: function() {
  var r = [{ v:'', l:'-- select subnet --' }];
  uci.sections('network', 'interface', function(s) {
    if (s.ipaddr && s.netmask) {
      var n = s.ipaddr.replace(/\.\d+$/, '.0/24');
      r.push({ v:n, l:s['.name'].toUpperCase()+' ('+n+')' });
    }
  });
  return r;
},

_devices: function(arp, dhcp) {
  var r = [{ v:'', l:'-- entire subnet --' }];
  var seen = {};
  // Build hostname lookup from DHCP leases (format: timestamp MAC IP hostname)
  var dhcpInfo = {};
  dhcp.trim().split(/\r?\n/).forEach(function(ln) {
    var p = ln.trim().split(/\s+/);
    if (p.length >= 4)
      dhcpInfo[p[2]] = { mac: p[1], name: p[3] !== '*' ? p[3] : '' };
  });
  // ARP table (format: IP type flags MAC iface)
  arp.trim().split(/\r?\n/).slice(1).forEach(function(ln) {
    var p = ln.trim().split(/\s+/);
    if (p.length >= 4 && p[3] !== '00:00:00:00:00:00' && !seen[p[0]]) {
      seen[p[0]] = 1;
      var ip = p[0], mac = p[3];
      var hostname = (dhcpInfo[ip] && dhcpInfo[ip].name) || '';
      var lbl = hostname ? hostname + ' - ' + ip : ip + ' (' + mac + ')';
      r.push({ v: ip, l: lbl });
    }
  });
  // DHCP-only entries not already in ARP
  Object.keys(dhcpInfo).forEach(function(ip) {
    if (!seen[ip]) {
      seen[ip] = 1;
      var hostname = dhcpInfo[ip].name;
      r.push({ v: ip, l: hostname ? hostname + ' - ' + ip : ip });
    }
  });
  // Static DHCP host reservations from /etc/config/dhcp
  uci.sections('dhcp', 'host').forEach(function(h) {
    var ip = h.ip, name = h.name || '';
    if (ip && !seen[ip]) {
      seen[ip] = 1;
      r.push({ v: ip, l: name ? name + ' - ' + ip + ' (static)' : ip + ' (static)' });
    }
  });
  return r;
},

_devicesInSubnet: function(subnet) {
  var all = this._devices(this._arp || '', this._dhcp || '');
  if (!subnet) return all;
  var prefix = subnet.replace(/\.0\/\d+$/, '.');
  return all.filter(function(d) { return !d.v || d.v.indexOf(prefix) === 0; });
},

_syncPbr: function(name, src, wan, secName) {
  if (!name || !src) return;
  var existing = uci.get('vpn_toggle', secName, 'pbr_rule') || '';
  var found = false;
  if (existing) {
    uci.sections('pbr', 'policy', function(p) {
      if (p['.name'] === existing) found = true;
    });
  }
  if (found) {
    uci.set('pbr', existing, 'name', name);
    uci.set('pbr', existing, 'src_addr', src);
    uci.set('pbr', existing, 'interface', wan);
  } else {
    var pbrName = 'vpntog_' + secName;
    uci.add('pbr', 'policy', pbrName);
    uci.set('pbr', pbrName, 'name', name);
    uci.set('pbr', pbrName, 'src_addr', src);
    uci.set('pbr', pbrName, 'interface', wan);
    uci.set('vpn_toggle', secName, 'pbr_rule', pbrName);
  }
},

_srcZoneForSubnet: function(subnet) {
  if (!subnet) return 'lan';
  var ifaceName = null;
  uci.sections('network', 'interface', function(s) {
    if (s.ipaddr && s.ipaddr.replace(/\.\d+$/, '.0/24') === subnet) ifaceName = s['.name'];
  });
  if (!ifaceName) return 'lan';
  var zoneName = 'lan';
  uci.sections('firewall', 'zone', function(z) {
    var nets = z.network || '';
    var netArr = Array.isArray(nets) ? nets : (nets ? nets.split(/\s+/) : []);
    if (netArr.indexOf(ifaceName) >= 0) zoneName = z.name;
  });
  return zoneName;
},

_ensureFirewallForwarding: function(vpnIface, subnet) {
  if (!vpnIface) return;
  var self = this;
  var srcZone = self._srcZoneForSubnet(subnet);
  var vpnZoneName = null;
  uci.sections('firewall', 'zone', function(z) {
    var nets = z.network || '';
    var netArr = Array.isArray(nets) ? nets : (nets ? nets.split(/\s+/) : []);
    if (netArr.indexOf(vpnIface) >= 0) vpnZoneName = z.name;
  });
  if (!vpnZoneName) return;
  var exists = false;
  uci.sections('firewall', 'forwarding', function(f) {
    if (f.src === srcZone && f.dest === vpnZoneName) exists = true;
  });
  if (exists) return;
  var fwdSec = uci.add('firewall', 'forwarding');
  uci.set('firewall', fwdSec, 'src', srcZone);
  uci.set('firewall', fwdSec, 'dest', vpnZoneName);
},

_cleanupFirewallForwarding: function(vpnIface, excludeSecName, subnet) {
  if (!vpnIface) return;
  var self = this;
  var srcZone = self._srcZoneForSubnet(subnet);
  var stillUsed = false;
  uci.sections('vpn_toggle', 'switch', function(s) {
    if (s['.name'] !== excludeSecName && s.vpn_if === vpnIface &&
        self._srcZoneForSubnet(s.target_subnet) === srcZone) stillUsed = true;
  });
  if (stillUsed) return;
  var vpnZoneName = null;
  uci.sections('firewall', 'zone', function(z) {
    var nets = z.network || '';
    var netArr = Array.isArray(nets) ? nets : (nets ? nets.split(/\s+/) : []);
    if (netArr.indexOf(vpnIface) >= 0) vpnZoneName = z.name;
  });
  if (!vpnZoneName) return;
  var toRemove = [];
  uci.sections('firewall', 'forwarding', function(f) {
    if (f.src === srcZone && f.dest === vpnZoneName) toRemove.push(f['.name']);
  });
  toRemove.forEach(function(n) { uci.remove('firewall', n); });
},

_deviceLabel: function(ip) {
  if (!ip) return '';
  var label = ip;
  this._devices(this._arp || '', this._dhcp || '').forEach(function(d) {
    if (d.v === ip) label = d.l;
  });
  return label;
},

_sel: function(opts, cur, size) {
  var attrs = { class:'cbi-input-select', style:'width:100%' };
  if (size) attrs.size = size;
  var s = E('select', attrs);
  opts.forEach(function(o) {
    var val = o.v !== undefined ? o.v : o;
    var lbl = o.l !== undefined ? o.l : o;
    var op = E('option', { value:val }, lbl);
    if (val === cur) op.selected = true;
    s.appendChild(op);
  });
  return s;
},

/* ── render ──────────────────────────────────────────────── */

render: function(data) {
  var self = this;
  self._dhcp = data[4] || '';
  self._arp  = data[5] || '';

  var page = E('div', { class:'cbi-map' });
  page.appendChild(E('h2', {}, 'VPN Toggle Settings'));
  page.appendChild(E('p', {}, [
    'Standalone toggle page: ',
    E('a', { href:'/vpntoggle/', target:'_blank' }, '/vpntoggle/')
  ]));

  /* Users */
  var uSec = E('div', { class:'cbi-section' });
  uSec.appendChild(E('h3', {}, 'Users'));
  uSec.appendChild(E('p', { class:'cbi-section-descr' }, 'Login credentials for the standalone toggle page.'));
  var uTable = self._buildUsersTable();
  uSec.appendChild(uTable);
  uSec.appendChild(E('br'));
  uSec.appendChild(E('button', { class:'cbi-button cbi-button-add', click: function() { self._addUserForm(uSec, uTable); } }, '+ Add User'));
  page.appendChild(uSec);
  page.appendChild(E('hr'));

  /* Switches */
  var swSec = E('div', { class:'cbi-section' });
  swSec.appendChild(E('h3', {}, 'Switch Configurations'));
  swSec.appendChild(E('p', { class:'cbi-section-descr' }, 'Switches are per user. PBR policies are created automatically on save.'));

  var users = uci.sections('vpn_toggle', 'user');
  var userSel = E('select', { class:'cbi-input-select', style:'margin-bottom:10px',
    change: function() { self._renderSwitches(swGrid, this.value); }
  });
  if (!users.length) {
    userSel.appendChild(E('option', { value:'' }, '-- add a user first --'));
  } else {
    users.forEach(function(u) {
      userSel.appendChild(E('option', { value: u.username||'' }, u.username||'(unnamed)'));
    });
  }
  swSec.appendChild(E('div', {}, [ E('label', { style:'font-weight:500;margin-right:8px' }, 'Showing switches for:'), userSel ]));

  var swGrid = E('div', { id:'sw-grid' });
  var initUser = users.length ? (users[0].username||'') : '';
  self._renderSwitches(swGrid, initUser);
  swSec.appendChild(swGrid);

  swSec.appendChild(E('br'));
  swSec.appendChild(E('button', { class:'cbi-button cbi-button-add', click: function() {
    self._addSwitchForm(swGrid, userSel.value);
  } }, '+ Add Switch'));

  page.appendChild(swSec);
  return page;
},

/* ── user table ──────────────────────────────────────────── */

_buildUsersTable: function() {
  var self = this;
  var t = E('table', { class:'table cbi-section-table', style:'width:100%' });
  t.appendChild(E('tr', { class:'tr table-titles' }, [
    E('th', { class:'th' }, 'Username'),
    E('th', { class:'th' }, 'Password'),
    E('th', { class:'th', style:'width:130px' }, 'Actions')
  ]));
  var users = uci.sections('vpn_toggle', 'user');
  if (!users.length) {
    t.appendChild(E('tr', { class:'tr' }, [ E('td', { class:'td', colspan:'3', style:'color:#888' }, 'No users yet.') ]));
  } else {
    users.forEach(function(u) { t.appendChild(self._userRow(t, u)); });
  }
  return t;
},

_userRow: function(table, u) {
  var self = this;
  var row = E('tr', { class:'tr' });
  row.appendChild(E('td', { class:'td' }, u.username||''));
  row.appendChild(E('td', { class:'td' }, '••••••••'));
  row.appendChild(E('td', { class:'td' }, [
    E('button', { class:'cbi-button cbi-button-edit', style:'margin-right:4px', click: function() {
      self._editUserRow(table, u['.name'], row);
    } }, 'Edit'),
    E('button', { class:'cbi-button cbi-button-remove', click: function(ev) {
      var btn = ev.currentTarget || ev.target;
      if (btn.textContent !== 'Sure?') {
        btn.textContent = 'Sure?';
        btn._delTimer = setTimeout(function() { btn.textContent = 'Delete'; }, 3000);
        return;
      }
      clearTimeout(btn._delTimer);
      btn.disabled = true;
      uci.remove('vpn_toggle', u['.name']);
      self._save().then(function() {
        var tbody = row.parentNode;
        tbody.removeChild(row);
        if (!tbody.querySelector('tr.tr:not(.table-titles)')) {
          tbody.appendChild(E('tr', { class:'tr' }, [ E('td', { class:'td', colspan:'3', style:'color:#888' }, 'No users yet.') ]));
        }
      });
    } }, 'Delete')
  ]));
  return row;
},

_editUserRow: function(table, secName, row) {
  var self = this;
  var uIn = E('input', { type:'text', class:'cbi-input-text', value: uci.get('vpn_toggle', secName, 'username')||'', style:'width:100%' });
  var pIn = E('input', { type:'password', class:'cbi-input-text', value: uci.get('vpn_toggle', secName, 'password')||'', style:'width:100%' });
  row.innerHTML = '';
  row.appendChild(E('td', { class:'td' }, [uIn]));
  row.appendChild(E('td', { class:'td' }, [pIn]));
  row.appendChild(E('td', { class:'td' }, [
    E('button', { class:'cbi-button cbi-button-save', style:'margin-right:4px', click: function() {
      uci.set('vpn_toggle', secName, 'username', uIn.value.trim());
      uci.set('vpn_toggle', secName, 'password', pIn.value);
      self._save().then(function() {
        var u2 = { '.name':secName, username: uIn.value.trim() };
        row.parentNode.replaceChild(self._userRow(table, u2), row);
      });
    } }, 'Save'),
    E('button', { class:'cbi-button', click: function() {
      var u2 = { '.name':secName, username: uci.get('vpn_toggle', secName, 'username')||'' };
      row.parentNode.replaceChild(self._userRow(table, u2), row);
    } }, 'Cancel')
  ]));
},

_addUserForm: function(section, table) {
  if (section.querySelector('#add-user-form')) return;
  var self = this;
  var adding = false;
  var uIn = E('input', { type:'text', class:'cbi-input-text', placeholder:'Username', style:'margin-right:6px;width:160px' });
  var pIn = E('input', { type:'password', class:'cbi-input-text', placeholder:'Password', style:'margin-right:6px;width:160px' });
  var form = E('div', { id:'add-user-form', style:'margin-top:8px;display:flex;gap:6px;align-items:center;flex-wrap:wrap' }, [
    uIn, pIn,
    E('button', { class:'cbi-button cbi-button-save', click: function() {
      if (adding) return;
      var un = uIn.value.trim(), pw = pIn.value;
      if (!un||!pw) return;
      adding = true;
      var ns = uci.add('vpn_toggle', 'user');
      uci.set('vpn_toggle', ns, 'username', un);
      uci.set('vpn_toggle', ns, 'password', pw);
      self._save().then(function() {
        section.removeChild(form);
        var newTable = self._buildUsersTable();
        table.parentNode.replaceChild(newTable, table);
      }).catch(function() { adding = false; });
    } }, 'Add'),
    E('button', { class:'cbi-button', click: function() { section.removeChild(form); } }, 'Cancel')
  ]);
  section.appendChild(form);
  uIn.focus();
},

/* ── switch table ────────────────────────────────────────── */

_renderSwitches: function(container, selUser) {
  var self = this;
  container.innerHTML = '';
  var switches = uci.sections('vpn_toggle', 'switch');
  var list = switches.filter(function(s) { return !s.user || s.user === selUser; });

  var t = E('table', { class:'table cbi-section-table', style:'width:100%' });
  t.appendChild(E('tr', { class:'tr table-titles' }, [
    E('th', { class:'th' }, 'Name'),
    E('th', { class:'th' }, 'Device / Subnet'),
    E('th', { class:'th' }, 'WAN'),
    E('th', { class:'th' }, 'VPN'),
    E('th', { class:'th', style:'width:64px;text-align:center' }, 'Enabled'),
    E('th', { class:'th', style:'width:140px' }, 'Actions')
  ]));

  if (!list.length) {
    t.appendChild(E('tr', { class:'tr' }, [ E('td', { class:'td', colspan:'6', style:'color:#888' }, 'No switches for this user.') ]));
  } else {
    list.forEach(function(sw) { t.appendChild(self._switchRow(t, sw, selUser, container)); });
  }
  container.appendChild(t);
},

_switchRow: function(table, sw, selUser, container) {
  var self = this;
  var curIf = sw.pbr_rule ? (uci.get('pbr', sw.pbr_rule, 'interface')||'') : '';
  var isVpn = curIf !== '' && curIf === sw.vpn_if;

  var chk = E('input', { type:'checkbox', title:'Enable on toggle page' });
  chk.checked = sw.enabled !== '0';
  chk.addEventListener('change', function() {
    uci.set('vpn_toggle', sw['.name'], 'enabled', chk.checked ? '1' : '0');
    self._save().then(function() { return ui.changes.apply(false); });
  });

  var row = E('tr', { class:'tr' });
  row.appendChild(E('td', { class:'td' }, sw.display_name||''));
  row.appendChild(E('td', { class:'td' }, sw.target_device ? self._deviceLabel(sw.target_device) : (sw.target_subnet||'')));
  row.appendChild(E('td', { class:'td' }, (sw.wan_if||'') + (!isVpn && curIf ? ' ✓' : '')));
  row.appendChild(E('td', { class:'td' }, (sw.vpn_if||'') + (isVpn ? ' ✓' : '')));
  row.appendChild(E('td', { class:'td', style:'text-align:center' }, [chk]));
  row.appendChild(E('td', { class:'td' }, [
    E('button', { class:'cbi-button cbi-button-edit', style:'margin-right:4px', click: function() {
      self._editSwitchInline(table, sw['.name'], row, selUser, container);
    } }, 'Edit'),
    E('button', { class:'cbi-button cbi-button-remove', click: function(ev) {
      var btn = ev.currentTarget || ev.target;
      if (btn.textContent !== 'Sure?') {
        btn.textContent = 'Sure?';
        btn._delTimer = setTimeout(function() { btn.textContent = 'Delete'; }, 3000);
        return;
      }
      clearTimeout(btn._delTimer);
      btn.disabled = true;
      var pbrRule = uci.get('vpn_toggle', sw['.name'], 'pbr_rule') || '';
      if (pbrRule) uci.remove('pbr', pbrRule);
      self._cleanupFirewallForwarding(sw.vpn_if, sw['.name'], sw.target_subnet);
      uci.remove('vpn_toggle', sw['.name']);
      self._save().then(function() {
        self._renderSwitches(container, selUser);
      }).catch(function() { btn.disabled = false; btn.textContent = 'Delete'; });
    } }, 'Delete')
  ]));
  return row;
},

_editSwitchInline: function(table, secName, row, selUser, container) {
  var self = this;
  var existingId = 'edit-' + secName;
  var existing = table.querySelector('#'+existingId);
  if (existing) { existing.parentNode.removeChild(existing); return; }

  var cur = {
    name:    uci.get('vpn_toggle', secName, 'display_name')||'',
    subnet:  uci.get('vpn_toggle', secName, 'target_subnet')||'',
    device:  uci.get('vpn_toggle', secName, 'target_device')||'',
    wan:     uci.get('vpn_toggle', secName, 'wan_if')||'',
    vpn:     uci.get('vpn_toggle', secName, 'vpn_if')||''
  };

  var nIn = E('input', { type:'text', class:'cbi-input-text', value:cur.name, placeholder:'Name', style:'width:100%' });
  var subSel = self._sel(self._subnets(), cur.subnet);
  var devSel = self._sel(self._devicesInSubnet(cur.subnet), cur.device);
  var wanSel = self._sel(self._ifaces(), cur.wan);
  var vpnSel = self._sel(self._ifaces(), cur.vpn);
  subSel.addEventListener('change', function() {
    var filtered = self._devicesInSubnet(subSel.value);
    devSel.innerHTML = '';
    filtered.forEach(function(o) { devSel.appendChild(E('option', { value: o.v }, o.l)); });
    devSel.value = '';
  });

  var editRow = E('tr', { id: existingId, class:'tr', style:'background:rgba(99,102,241,.07)' }, [
    E('td', { class:'td', colspan:'6' }, [
      E('div', { style:'display:flex;flex-direction:column;gap:8px;padding:10px' }, [
        E('div', {}, [E('div', { style:'font-size:.8rem;color:#94a3b8;margin-bottom:2px' }, 'Display Name'), E('div', {}, nIn)]),
        E('div', {}, [E('div', { style:'font-size:.8rem;color:#94a3b8;margin-bottom:2px' }, 'Subnet'), E('div', {}, subSel)]),
        E('div', {}, [E('div', { style:'font-size:.8rem;color:#94a3b8;margin-bottom:2px' }, 'Device (opt.)'), E('div', {}, devSel)]),
        E('div', {}, [E('div', { style:'font-size:.8rem;color:#94a3b8;margin-bottom:2px' }, 'WAN'), E('div', {}, wanSel)]),
        E('div', {}, [E('div', { style:'font-size:.8rem;color:#94a3b8;margin-bottom:2px' }, 'VPN'), E('div', {}, vpnSel)])
      ]),
      E('div', { style:'padding:0 10px 10px;display:flex;gap:8px' }, [
        E('button', { class:'cbi-button cbi-button-save', click: function() {
          uci.set('vpn_toggle', secName, 'display_name', nIn.value.trim());
          uci.set('vpn_toggle', secName, 'target_subnet', subSel.value);
          uci.set('vpn_toggle', secName, 'target_device', devSel.value);
          uci.set('vpn_toggle', secName, 'wan_if', wanSel.value);
          uci.set('vpn_toggle', secName, 'vpn_if', vpnSel.value);
          self._syncPbr(nIn.value.trim(), devSel.value||subSel.value, wanSel.value, secName);
          self._ensureFirewallForwarding(vpnSel.value, subSel.value);
          if (cur.vpn !== vpnSel.value || cur.subnet !== subSel.value) self._cleanupFirewallForwarding(cur.vpn, secName, cur.subnet);
          self._save().then(function() {
            editRow.parentNode.removeChild(editRow);
            self._renderSwitches(container, selUser);
          });
        } }, 'Save'),
        E('button', { class:'cbi-button', click: function() { editRow.parentNode.removeChild(editRow); } }, 'Cancel')
      ])
    ])
  ]);
  row.parentNode.insertBefore(editRow, row.nextSibling);
},

_addSwitchForm: function(container, selUser) {
  var self = this;
  if (container.querySelector('#add-sw-form')) return;

  var adding = false;
  var nIn = E('input', { type:'text', class:'cbi-input-text', placeholder:'Display Name', style:'width:100%' });
  var subSel = self._sel(self._subnets(), '');
  var devSel = self._sel(self._devicesInSubnet(''), '', 0);
  var wanSel = self._sel(self._ifaces(), '');
  var vpnSel = self._sel(self._ifaces(), '');
  subSel.addEventListener('change', function() {
    var filtered = self._devicesInSubnet(subSel.value);
    devSel.innerHTML = '';
    filtered.forEach(function(o) { devSel.appendChild(E('option', { value: o.v }, o.l)); });
    devSel.value = '';
  });

  var form = E('div', { id:'add-sw-form', style:'margin-top:12px;padding:14px;border:1px solid #334155;border-radius:8px' }, [
    E('h4', { style:'margin:0 0 10px' }, 'New Switch'),
    E('div', { style:'display:flex;flex-direction:column;gap:8px;margin-bottom:10px' }, [
      E('div', {}, [E('div', { style:'font-size:.8rem;color:#94a3b8;margin-bottom:2px' }, 'Display Name'), E('div', {}, nIn)]),
      E('div', {}, [E('div', { style:'font-size:.8rem;color:#94a3b8;margin-bottom:2px' }, 'Subnet'), E('div', {}, subSel)]),
      E('div', {}, [E('div', { style:'font-size:.8rem;color:#94a3b8;margin-bottom:2px' }, 'Device (opt.)'), E('div', {}, devSel)]),
      E('div', {}, [E('div', { style:'font-size:.8rem;color:#94a3b8;margin-bottom:2px' }, 'WAN'), E('div', {}, wanSel)]),
      E('div', {}, [E('div', { style:'font-size:.8rem;color:#94a3b8;margin-bottom:2px' }, 'VPN'), E('div', {}, vpnSel)])
    ]),
    E('div', { style:'display:flex;gap:8px' }, [
      E('button', { class:'cbi-button cbi-button-save', click: function() {
        if (adding) return;
        var name = nIn.value.trim();
        if (!name) return;
        adding = true;
        var ns = uci.add('vpn_toggle', 'switch');
        uci.set('vpn_toggle', ns, 'display_name', name);
        uci.set('vpn_toggle', ns, 'target_subnet', subSel.value);
        uci.set('vpn_toggle', ns, 'target_device', devSel.value);
        uci.set('vpn_toggle', ns, 'wan_if', wanSel.value);
        uci.set('vpn_toggle', ns, 'vpn_if', vpnSel.value);
        uci.set('vpn_toggle', ns, 'user', selUser);
        uci.set('vpn_toggle', ns, 'enabled', '1');
        self._syncPbr(name, devSel.value||subSel.value, wanSel.value, ns);
        self._ensureFirewallForwarding(vpnSel.value, subSel.value);
        self._save().then(function() {
          self._renderSwitches(container, selUser);
        }).catch(function() { adding = false; });
      } }, 'Add Switch'),
      E('button', { class:'cbi-button', click: function() { container.removeChild(form); } }, 'Cancel')
    ])
  ]);
  container.appendChild(form);
  nIn.focus();
},

handleSave: function() { return this._save(); },
handleSaveApply: function(ev, mode) { return this.handleSave(ev).then(function() { return ui.changes.apply(mode === '0'); }); }

});