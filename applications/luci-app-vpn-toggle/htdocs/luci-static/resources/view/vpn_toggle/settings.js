'use strict';
'require view';
'require uci';
'require ui';
'require fs';
'require rpc';

var callUciApply = rpc.declare({ object: 'uci', method: 'apply', params: ['timeout', 'rollback'], reject: true });

return view.extend({

load: function() {
  return Promise.all([
    uci.load('vpn_toggle'),
    uci.load('pbr'),
    uci.load('network'),
    uci.load('dhcp'),
    fs.read('/var/dhcp.leases').catch(function(){ return ''; }),
    fs.read('/proc/net/arp').catch(function(){ return ''; }),
    uci.load('firewall').catch(function(){ return null; }),
    uci.load('rpcd').catch(function(){ return null; }),
    rpc.declare({ object: 'session', method: 'get', params: ['keys'], expect: { values: {} } })(['username']).catch(function(){ return null; })
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
  var r = [{ v:'', l:_('-- select subnet --') }];
  uci.sections('network', 'interface', function(s) {
    var ip = s.ipaddr || (Array.isArray(s.ipaddrs) && s.ipaddrs[0]);
    if (ip && ip.indexOf('/') === -1) { // Basic IPv4 check
      var n = ip.replace(/\.\d+$/, '.0/24');
      var name = s['.name'] || 'unknown';
      r.push({ v:n, l:name.toUpperCase()+' ('+n+')' });
    }
  });
  return r;
},

_devices: function(arp, dhcp) {
  var r = [{ v:'', l:_('-- entire subnet --') }];
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
    var ip = s.ipaddr || (Array.isArray(s.ipaddrs) && s.ipaddrs[0]);
    if (ip && ip.replace(/\.\d+$/, '.0/24') === subnet) ifaceName = s['.name'];
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

// Returns true if the IP already had a static lease (nothing created).
// Returns false if we created the static lease (should be removed on switch delete).
// suggestedName: fallback hostname if none found in DHCP leases (e.g. from device dropdown label).
_ensureStaticLease: function(ip, suggestedName) {
  var self = this;
  if (!ip) return true;
  var alreadyStatic = false;
  uci.sections('dhcp', 'host', function(h) { if (h.ip === ip) alreadyStatic = true; });
  if (alreadyStatic) return true;
  var mac = null, hostname = null;
  var dhcpInfo = {};
  (self._dhcp || '').trim().split(/\r?\n/).forEach(function(ln) {
    var p = ln.trim().split(/\s+/);
    if (p.length >= 4) dhcpInfo[p[2]] = { mac: p[1], name: p[3] !== '*' ? p[3] : '' };
  });
  if (dhcpInfo[ip]) { mac = dhcpInfo[ip].mac; hostname = dhcpInfo[ip].name || null; }
  if (!mac) {
    (self._arp || '').trim().split(/\r?\n/).slice(1).forEach(function(ln) {
      var p = ln.trim().split(/\s+/);
      if (p.length >= 4 && p[0] === ip && p[3] !== '00:00:00:00:00:00') mac = p[3];
    });
  }
  if (!mac) return true; // no MAC found – can't create reservation, treat as already static
  if (!hostname && suggestedName) hostname = suggestedName;
  var ns = uci.add('dhcp', 'host');
  uci.set('dhcp', ns, 'ip', ip);
  uci.set('dhcp', ns, 'mac', mac);
  uci.set('dhcp', ns, 'leasetime', 'infinite');
  if (hostname) uci.set('dhcp', ns, 'name', hostname);
  return false;
},

_restoreStaticLease: function(ip) {
  if (!ip) return;
  var toRemove = [];
  uci.sections('dhcp', 'host', function(h) { if (h.ip === ip) toRemove.push(h['.name']); });
  toRemove.forEach(function(n) { uci.remove('dhcp', n); });
},

_deviceLabel: function(ip) {
  if (!ip) return '';
  var label = ip;
  this._devices(this._arp || '', this._dhcp || '').forEach(function(d) {
    if (d.v === ip) label = d.l;
  });
  return label;
},

_rpcdUsers: function() {
  var r = [{ v:'', l:_('\u2014 all users \u2014') }];
  uci.sections('rpcd', 'login', function(s) {
    var readList = s.read || [];
    if (!Array.isArray(readList)) readList = [readList];
    if (readList.indexOf('luci-app-vpn-toggle') < 0) return;
    var un = s.username || s['.name'];
    r.push({ v: un, l: un });
  });
  return r;
},

_sel: function(opts, cur) {
  var s = E('select', { class:'cbi-input-select', style:'width:100%' });
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
  var sessionInfo = data[8];
  var currentUser = (sessionInfo && sessionInfo.username) || '';
  var isAdmin = currentUser === 'root';
  self._dhcp = data[4] || '';
  self._arp  = data[5] || '';

  var page = E('div', { class:'cbi-map' });
  page.appendChild(E('h2', {}, _('VPN Toggle Settings')));

  if (!isAdmin) {
    page.appendChild(E('p', { style:'color:#f87171;margin-top:1em' },
      _('Settings can only be modified by the admin (root) user.')));
    return page;
  }

  /* Users */
  var uSec = E('div', { class:'cbi-section' });
  uSec.appendChild(E('h3', {}, _('VPN Toggle Users')));
  uSec.appendChild(E('p', { class:'cbi-section-descr' },
    _('Users who can access the VPN Toggle page. Passwords are stored via the system shadow database (same as the main router login).')));

  var uTable = self._buildRpcdUsersTable();
  uSec.appendChild(uTable);
  uSec.appendChild(E('br'));
  uSec.appendChild(E('button', { class:'cbi-button cbi-button-add', click: function() {
    self._addRpcdUserForm(uSec, uTable);
  } }, _('+ Add User')));
  page.appendChild(uSec);

  page.appendChild(E('hr', { style:'margin:16px 0;border-color:#334155' }));

  /* Switches */
  var swSec = E('div', { class:'cbi-section' });
  swSec.appendChild(E('h3', {}, _('Switch Configurations')));
  swSec.appendChild(E('p', { class:'cbi-section-descr' }, _('PBR policies are created automatically on save.')));

  var swGrid = E('div', { id:'sw-grid' });
  self._renderSwitches(swGrid);
  swSec.appendChild(swGrid);

  swSec.appendChild(E('br'));
  swSec.appendChild(E('button', { class:'cbi-button cbi-button-add', click: function() {
    self._addSwitchForm(swGrid);
  } }, _('+ Add Switch')));

  page.appendChild(swSec);
  return page;
},

/* ── rpcd user table ────────────────────────────────────── */

_buildRpcdUsersTable: function() {
  var self = this;
  var t = E('table', { class:'table cbi-section-table', style:'width:100%' });
  t.appendChild(E('tr', { class:'tr table-titles' }, [
    E('th', { class:'th' }, _('Username')),
    E('th', { class:'th', style:'width:120px' }, _('Actions'))
  ]));
  var found = false;
  uci.sections('rpcd', 'login', function(s) {
    var readList = s.read || [];
    if (!Array.isArray(readList)) readList = [readList];
    if (readList.indexOf('luci-app-vpn-toggle') < 0) return;
    found = true;
    t.appendChild(self._rpcdUserRow(t, s));
  });
  if (!found) {
    t.appendChild(E('tr', { class:'tr' }, [
      E('td', { class:'td', colspan:'2', style:'color:#888' }, _('No VPN toggle users yet.'))
    ]));
  }
  return t;
},

_rpcdUserRow: function(table, s) {
  var self = this;
  var username = s.username || s['.name'];
  var row = E('tr', { class:'tr' });
  row.appendChild(E('td', { class:'td' }, username));
  row.appendChild(E('td', { class:'td' }, [
    E('button', { class:'cbi-button cbi-button-remove', click: function(ev) {
      var btn = ev.currentTarget || ev.target;
      if (btn.textContent !== _('Sure?')) {
        btn.textContent = _('Sure?');
        btn._delTimer = setTimeout(function() { btn.textContent = _('Delete'); }, 3000);
        return;
      }
      clearTimeout(btn._delTimer);
      btn.disabled = true;
      fs.exec('/usr/share/vpn-toggle/user-manager', ['remove', username])
        .catch(function() {})
        .then(function() {
          uci.remove('rpcd', s['.name']);
          return self._save();
        })
        .then(function() {
          var tbody = row.parentNode;
          tbody.removeChild(row);
          if (!tbody.querySelector('tr.tr:not(.table-titles)')) {
            tbody.appendChild(E('tr', { class:'tr' }, [
              E('td', { class:'td', colspan:'2', style:'color:#888' }, _('No VPN toggle users yet.'))
            ]));
          }
        })
        .catch(function(e) {
          btn.disabled = false;
          btn.textContent = _('Delete');
          ui.addNotification(null, E('p', {}, _('Delete failed: %s').format(String(e))));
        });
    } }, _('Delete'))
  ]));
  return row;
},

_addRpcdUserForm: function(section, table) {
  if (section.querySelector('#add-rpcd-user-form')) return;
  var self = this;
  var adding = false;

  var uIn = E('input', { type:'text', class:'cbi-input-text',
    placeholder:_('Username (a-z, 0-9, _)'), style:'width:160px' });
  var pIn = E('input', { type:'password', class:'cbi-input-text',
    placeholder:_('Password'), style:'width:160px' });
  var errEl = E('span', { style:'color:#f87171;font-size:.85rem;margin-left:6px' }, '');

  var form = E('div', { id:'add-rpcd-user-form',
    style:'margin-top:10px;display:flex;flex-wrap:wrap;gap:8px;align-items:center' }, [
    uIn, pIn,
    E('button', { class:'cbi-button cbi-button-save', click: function() {
      if (adding) return;
      var un = uIn.value.trim();
      var pw = pIn.value;
      if (!un || !pw) { errEl.textContent = _('Username and password are required.'); return; }
      if (!/^[a-zA-Z][a-zA-Z0-9_]{0,31}$/.test(un)) {
        errEl.textContent = _('Must start with a letter; only letters, digits, underscore (max 32).');
        return;
      }
      adding = true;
      ui.showModal(null, E('p', { class: 'spinning' }, _('Creating system user and setting permissions...')));
      // Step 1: create unix user entry (passwd + locked shadow row)
      fs.exec('/usr/share/vpn-toggle/user-manager', ['add', un])
        .then(function(res) {
          var result = {};
          try { result = JSON.parse(res.stdout || '{}'); } catch(e) {}
          if (res.code !== 0 || result.error) throw new Error(result.error || 'user-manager failed');
          // Step 2: hash & store password via luci ubus (same as System > Administration)
          return rpc.declare({ object: 'luci', method: 'setPassword', params: ['username', 'password'] })(un, pw);
        })
        .then(function(res) {
          if (!res || res.result === false)
            throw new Error(_('Password could not be set \u2014 check the username.'));
          // Step 3: add rpcd login section referencing unix shadow ($p$ prefix)
          // luci-base            = required for the LuCI UI framework to function
          // luci-app-vpn-toggle  = grants access to the Toggle page (also first landing page)
          var ns = uci.add('rpcd', 'login');
          uci.set('rpcd', ns, 'username', un);
          uci.set('rpcd', ns, 'password', '$p$' + un);
          uci.set('rpcd', ns, 'read', ['luci-base', 'luci-app-vpn-toggle']);
          uci.set('rpcd', ns, 'write', ['luci-base', 'luci-app-vpn-toggle']);
          return self._save();
        })
        .then(function() {
          ui.hideModal();
          section.removeChild(form);
          var newTable = self._buildRpcdUsersTable();
          table.parentNode.replaceChild(newTable, table);
        })
        .catch(function(e) {
          adding = false;
          ui.hideModal();
          errEl.textContent = String(e);
        });
    } }, _('Add')),
    E('button', { class:'cbi-button', click: function() { section.removeChild(form); } }, _('Cancel')),
    errEl
  ]);
  section.appendChild(form);
  uIn.focus();
},

/* ── switch table ────────────────────────────────────────── */

_renderSwitches: function(container) {
  var self = this;
  container.innerHTML = '';
  var list = uci.sections('vpn_toggle', 'switch');

  var t = E('table', { class:'table cbi-section-table', style:'width:100%' });
  t.appendChild(E('tr', { class:'tr table-titles' }, [
    E('th', { class:'th' }, _('Name')),
    E('th', { class:'th' }, _('Device / Subnet')),
    E('th', { class:'th' }, _('WAN')),
    E('th', { class:'th' }, _('VPN')),
    E('th', { class:'th', style:'width:110px' }, _('Visible to')),
    E('th', { class:'th', style:'width:64px;text-align:center' }, _('Enabled')),
    E('th', { class:'th', style:'width:140px' }, _('Actions'))
  ]));

  if (!list.length) {
    t.appendChild(E('tr', { class:'tr' }, [ E('td', { class:'td', colspan:'7', style:'color:#888' }, _('No switches configured.')) ]));
  } else {
    list.forEach(function(sw) { t.appendChild(self._switchRow(t, sw, container)); });
  }
  container.appendChild(t);
},

_switchRow: function(table, sw, container) {
  var self = this;
  var curIf = sw.pbr_rule ? (uci.get('pbr', sw.pbr_rule, 'interface')||'') : '';
  var isVpn = curIf !== '' && curIf === sw.vpn_if;

  var chk = E('input', { type:'checkbox', title:_('Enable on toggle page') });
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
  row.appendChild(E('td', { class:'td' }, sw.user || '—'));
  row.appendChild(E('td', { class:'td', style:'text-align:center' }, [chk]));
  row.appendChild(E('td', { class:'td' }, [
    E('button', { class:'cbi-button cbi-button-edit', style:'margin-right:4px', click: function() {
      self._editSwitchInline(table, sw['.name'], row, container);
    } }, _('Edit')),
    E('button', { class:'cbi-button cbi-button-remove', click: function(ev) {
      var btn = ev.currentTarget || ev.target;
      if (btn.textContent !== _('Sure?')) {
        btn.textContent = _('Sure?');
        btn._delTimer = setTimeout(function() { btn.textContent = _('Delete'); }, 3000);
        return;
      }
      clearTimeout(btn._delTimer);
      btn.disabled = true;
      var pbrRule = uci.get('vpn_toggle', sw['.name'], 'pbr_rule') || '';
      if (pbrRule) uci.remove('pbr', pbrRule);
      self._cleanupFirewallForwarding(sw.vpn_if, sw['.name'], sw.target_subnet);
      if (sw.target_device && uci.get('vpn_toggle', sw['.name'], 'dhcp_made_static') === '1')
        self._restoreStaticLease(sw.target_device);
      uci.remove('vpn_toggle', sw['.name']);
      self._save()
        .then(function() { return callUciApply(null, false); })
        .then(function() {
          self._renderSwitches(container);
        }).catch(function() { btn.disabled = false; btn.textContent = _('Delete'); });
    } }, _('Delete'))
  ]));
  return row;
},

_editSwitchInline: function(table, secName, row, container) {
  var self = this;
  var existingId = 'edit-' + secName;
  var existing = table.querySelector('#'+existingId);
  if (existing) { existing.parentNode.removeChild(existing); return; }

  var cur = {
    name:    uci.get('vpn_toggle', secName, 'display_name')||'',
    subnet:  uci.get('vpn_toggle', secName, 'target_subnet')||'',
    device:  uci.get('vpn_toggle', secName, 'target_device')||'',
    wan:     uci.get('vpn_toggle', secName, 'wan_if')||'',
    vpn:     uci.get('vpn_toggle', secName, 'vpn_if')||'',
    user:    uci.get('vpn_toggle', secName, 'user')||''
  };

  var nIn = E('input', { type:'text', class:'cbi-input-text', value:cur.name, placeholder:_('Name'), style:'width:100%' });
  var userIn = self._sel(self._rpcdUsers(), cur.user);
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
    E('td', { class:'td', colspan:'7' }, [
      E('div', { style:'display:flex;flex-direction:column;gap:8px;padding:10px' }, [
        E('div', {}, [E('div', { style:'font-size:.8rem;color:#94a3b8;margin-bottom:2px' }, _('Display Name')), E('div', {}, nIn)]),
        E('div', {}, [E('div', { style:'font-size:.8rem;color:#94a3b8;margin-bottom:2px' }, _('Visible to')), E('div', {}, userIn)]),
        E('div', {}, [E('div', { style:'font-size:.8rem;color:#94a3b8;margin-bottom:2px' }, _('Subnet')), E('div', {}, subSel)]),
        E('div', {}, [E('div', { style:'font-size:.8rem;color:#94a3b8;margin-bottom:2px' }, _('Device (opt.)')), E('div', {}, devSel)]),
        E('div', {}, [E('div', { style:'font-size:.8rem;color:#94a3b8;margin-bottom:2px' }, _('WAN')), E('div', {}, wanSel)]),
        E('div', {}, [E('div', { style:'font-size:.8rem;color:#94a3b8;margin-bottom:2px' }, _('VPN')), E('div', {}, vpnSel)])
      ]),
      E('div', { style:'padding:0 10px 10px;display:flex;gap:8px' }, [
        E('button', { class:'cbi-button cbi-button-save', click: function() {
          uci.set('vpn_toggle', secName, 'display_name', nIn.value.trim());
          uci.set('vpn_toggle', secName, 'user', userIn.value.trim());
          uci.set('vpn_toggle', secName, 'target_subnet', subSel.value);
          uci.set('vpn_toggle', secName, 'target_device', devSel.value);
          uci.set('vpn_toggle', secName, 'wan_if', wanSel.value);
          uci.set('vpn_toggle', secName, 'vpn_if', vpnSel.value);
          self._syncPbr(nIn.value.trim(), devSel.value||subSel.value, wanSel.value, secName);
          self._ensureFirewallForwarding(vpnSel.value, subSel.value);
          if (cur.vpn !== vpnSel.value || cur.subnet !== subSel.value) self._cleanupFirewallForwarding(cur.vpn, secName, cur.subnet);
          if (cur.device !== devSel.value) {
            var oldMadeStatic = uci.get('vpn_toggle', secName, 'dhcp_made_static') || '0';
            if (cur.device && oldMadeStatic === '1') self._restoreStaticLease(cur.device);
            if (devSel.value) {
              var devOpt2 = devSel.options[devSel.selectedIndex];
              var devLabel2 = devOpt2 ? devOpt2.text : '';
              var dashIdx2 = devLabel2.indexOf(' - ');
              var devName2 = dashIdx2 > 0 ? devLabel2.substring(0, dashIdx2) : null;
              var ws = self._ensureStaticLease(devSel.value, devName2);
              uci.set('vpn_toggle', secName, 'dhcp_made_static', ws ? '0' : '1');
            } else {
              uci.set('vpn_toggle', secName, 'dhcp_made_static', '0');
            }
          }
          self._save()
            .then(function() { return callUciApply(null, false); })
            .then(function() {
              editRow.parentNode.removeChild(editRow);
              self._renderSwitches(container);
            });
        } }, _('Save')),
        E('button', { class:'cbi-button', click: function() { editRow.parentNode.removeChild(editRow); } }, _('Cancel'))
      ])
    ])
  ]);
  row.parentNode.insertBefore(editRow, row.nextSibling);
},

_addSwitchForm: function(container) {
  var self = this;
  if (container.querySelector('#add-sw-form')) return;

  var adding = false;
  var nIn = E('input', { type:'text', class:'cbi-input-text', placeholder:_('Display Name'), style:'width:100%' });
  var userIn = self._sel(self._rpcdUsers(), '');
  var subSel = self._sel(self._subnets(), '');
  var devSel = self._sel(self._devicesInSubnet(''), '');
  var wanSel = self._sel(self._ifaces(), '');
  var vpnSel = self._sel(self._ifaces(), '');
  subSel.addEventListener('change', function() {
    var filtered = self._devicesInSubnet(subSel.value);
    devSel.innerHTML = '';
    filtered.forEach(function(o) { devSel.appendChild(E('option', { value: o.v }, o.l)); });
    devSel.value = '';
  });

  var form = E('div', { id:'add-sw-form', style:'margin-top:12px;padding:14px;border:1px solid #334155;border-radius:8px' }, [
    E('h4', { style:'margin:0 0 10px' }, _('New Switch')),
    E('div', { style:'display:flex;flex-direction:column;gap:8px;margin-bottom:10px' }, [
      E('div', {}, [E('div', { style:'font-size:.8rem;color:#94a3b8;margin-bottom:2px' }, _('Display Name')), E('div', {}, nIn)]),
      E('div', {}, [E('div', { style:'font-size:.8rem;color:#94a3b8;margin-bottom:2px' }, _('Visible to')), E('div', {}, userIn)]),
      E('div', {}, [E('div', { style:'font-size:.8rem;color:#94a3b8;margin-bottom:2px' }, _('Subnet')), E('div', {}, subSel)]),
      E('div', {}, [E('div', { style:'font-size:.8rem;color:#94a3b8;margin-bottom:2px' }, _('Device (opt.)')), E('div', {}, devSel)]),
      E('div', {}, [E('div', { style:'font-size:.8rem;color:#94a3b8;margin-bottom:2px' }, _('WAN')), E('div', {}, wanSel)]),
      E('div', {}, [E('div', { style:'font-size:.8rem;color:#94a3b8;margin-bottom:2px' }, _('VPN')), E('div', {}, vpnSel)])
    ]),
    E('div', { style:'display:flex;gap:8px' }, [
      E('button', { class:'cbi-button cbi-button-save', click: function() {
        if (adding) return;
        var name = nIn.value.trim();
        if (!name) return;
        adding = true;
        var ns = uci.add('vpn_toggle', 'switch');
        uci.set('vpn_toggle', ns, 'display_name', name);
        if (userIn.value.trim()) uci.set('vpn_toggle', ns, 'user', userIn.value.trim());
        uci.set('vpn_toggle', ns, 'target_subnet', subSel.value);
        uci.set('vpn_toggle', ns, 'target_device', devSel.value);
        uci.set('vpn_toggle', ns, 'wan_if', wanSel.value);
        uci.set('vpn_toggle', ns, 'vpn_if', vpnSel.value);
        uci.set('vpn_toggle', ns, 'enabled', '1');
        self._syncPbr(name, devSel.value||subSel.value, wanSel.value, ns);
        self._ensureFirewallForwarding(vpnSel.value, subSel.value);
        if (devSel.value) {
          var devOpt = devSel.options[devSel.selectedIndex];
          var devLabel = devOpt ? devOpt.text : '';
          var dashIdx = devLabel.indexOf(' - ');
          var devName = dashIdx > 0 ? devLabel.substring(0, dashIdx) : null;
          var wasStatic = self._ensureStaticLease(devSel.value, devName);
          uci.set('vpn_toggle', ns, 'dhcp_made_static', wasStatic ? '0' : '1');
        }
        self._save()
          .then(function() { return callUciApply(null, false); })
          .then(function() {
            self._renderSwitches(container);
          }).catch(function() { adding = false; });
      } }, _('Add Switch')),
      E('button', { class:'cbi-button', click: function() { container.removeChild(form); } }, _('Cancel'))
    ])
  ]);
  container.appendChild(form);
  nIn.focus();
},

handleSave: function() { return this._save(); },
handleSaveApply: function(ev, mode) { return this.handleSave(ev).then(function() { return ui.changes.apply(mode === '0'); }); }

});