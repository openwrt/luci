'use strict';
'require view';
'require uci';
'require fs';
'require ui';
'require rpc';

var callUciApply = rpc.declare({ object: 'uci', method: 'apply', params: ['timeout', 'rollback'], reject: true });

return view.extend({

  load: function() {
    return Promise.all([
      uci.load('vpn_toggle'),
      uci.load('pbr'),
      rpc.declare({ object: 'session', method: 'get', params: ['keys'], expect: { values: {} } })(['username']).catch(function(){ return null; })
    ]);
  },

  render: function(data) {
    var self = this;
    var sessionInfo = data[2];
    var currentUser = (sessionInfo && sessionInfo.username) || '';
    var isAdmin     = !currentUser || currentUser === 'root';
    var switches    = uci.sections('vpn_toggle', 'switch');
    /* Show a switch when: enabled AND (no user restriction OR current user matches OR admin) */
    var enabled  = switches.filter(function(s) {
      return s.enabled !== '0' && (!s.user || isAdmin || s.user === currentUser);
    });

    var page = E('div', { 'class': 'cbi-map' });
    page.appendChild(E('h2', {}, _('VPN Toggle')));

    if (!enabled.length) {
      page.appendChild(E('p', { style: 'color:#888;margin-top:1em' },
        _('No active switches. Configure them in Settings.')));
      return page;
    }

    var grid = E('div', {
      style: 'display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:16px;margin-top:1.5em'
    });

    enabled.forEach(function(sw) {
      grid.appendChild(self._buildCard(sw));
    });

    page.appendChild(grid);
    return page;
  },

  _buildCard: function(sw) {
    var self = this;
    var rule  = sw.pbr_rule || '';
    var curIf = rule ? (uci.get('pbr', rule, 'interface') || '') : '';
    var isVpn = curIf !== '' && curIf === sw.vpn_if;

    var badge = E('span', {
      style: 'display:inline-block;padding:3px 10px;border-radius:12px;' +
             'font-size:.75rem;font-weight:600;margin-top:6px;' +
             (isVpn ? 'background:#083344;color:#67e8f9'
                    : 'background:#1e3a5f;color:#93c5fd')
    }, isVpn ? _('VPN') : _('Direct'));

    var via = E('div', {
      style: 'font-size:.75rem;color:#94a3b8;margin-top:4px'
    }, _('via %s').format(curIf || '—'));

    var btn = E('button', {
      'class': 'cbi-button',
      style: 'margin-top:10px;width:100%',
      click: function() { self._doToggle(sw, btn); }
    }, isVpn ? '\u21E6 ' + _('Switch to Direct') : '\u21E8 ' + _('Switch to VPN'));

    return E('div', {
      style: 'background:var(--background-color-medium,#1e293b);' +
             'border:1px solid var(--border-color-medium,#334155);' +
             'border-radius:10px;padding:18px'
    }, [
      E('div', { style: 'font-weight:600;font-size:1rem' }, sw.display_name || sw['.name']),
      badge,
      via,
      btn
    ]);
  },

  _doToggle: function(sw, btn) {
    var self = this;
    btn.disabled = true;
    btn.textContent = _('Switching\u2026');
    ui.showModal(null, E('p', { 'class': 'spinning' }, _('Applying network policies and restarting PBR...')));

    var rule = sw.pbr_rule;
    if (!rule) {
      ui.addNotification(null, E('p', {}, _('Switch has no PBR rule configured.')));
      btn.disabled = false;
      btn.textContent = _('Error');
      ui.hideModal();
      return;
    }

    var curIf     = uci.get('pbr', rule, 'interface') || '';
    var nextIf    = (curIf === sw.wan_if) ? sw.vpn_if : sw.wan_if;
    var activeSrc = sw.target_device || sw.target_subnet || '';
    var oldSrc    = uci.get('pbr', rule, 'src_addr') || activeSrc;

    uci.set('pbr', rule, 'interface', nextIf);
    if (activeSrc) uci.set('pbr', rule, 'src_addr', activeSrc);

    /* Toggle the associated DNS policy rule when one exists with the same src */
    uci.sections('pbr', 'dns_policy', function(p) {
      if (p.src_addr === oldSrc)
        uci.set('pbr', p['.name'], 'enabled', nextIf === sw.vpn_if ? '1' : '0');
    });

    uci.save()
      .then(function() { return callUciApply(null, false); })
      .then(function() {
        return fs.exec('/etc/init.d/pbr', ['restart']);
      })
      .then(function() {
        uci.unload('pbr');
        uci.unload('vpn_toggle');
        return Promise.all([uci.load('vpn_toggle'), uci.load('pbr')]);
      })
      .then(function() { return self.load(); })
      .then(function(newData) { return self.render(newData); })
      .then(function(newPage) {
        ui.hideModal();
        var old = btn.closest('.cbi-map');
        if (old && old.parentNode) old.parentNode.replaceChild(newPage, old);
      })
      .catch(function(err) {
        ui.hideModal();
        ui.addNotification(null, E('p', {}, _('Toggle failed: %s').format(String(err))));
        btn.disabled = false;
        btn.textContent = _('Error \u2013 retry');
      });
  },

  handleSave:      null,
  handleSaveApply: null,
  handleReset:     null
});
