'use strict';
'require view';
'require fs';
'require poll';
'require dom';

return view.extend({
	load: function() {
		return Promise.all([
			L.resolveDefault(fs.read('/var/run/wificalling-gateway/status.json'), '{}'),
			L.resolveDefault(fs.read('/var/run/wificalling-gateway/service-health.json'), '{}')
		]);
	},
	render: function(data) {
		function parse(value) { try { return JSON.parse(value); } catch (e) { return { devices: [] }; } }
		function when(epoch) { return epoch ? new Date(epoch * 1000).toLocaleString() : '-'; }
		function wfcLabel(v) {
			switch (v) {
				case 'registered': return _('Registered');
				case 'connecting': return _('Connecting');
				case 'not_detected': return _('Not detected');
				case 'likely_registered': return _('Likely registered');
				case 'active_traffic': return _('Active traffic');
				case 'nat_t_seen': return _('NAT-T seen');
				case 'negotiating': return _('Negotiating');
				case 'no_session': return _('No session');
				default: return v || '-';
			}
		}

		/* ---------- 服务状态 ---------- */
		var healthRaw = data[1];
		function parseHealth(value) { try { return JSON.parse(value); } catch (e) { return {}; } }
		function healthText(h) {
			if (!h || h.config_present == null) return _('No health data yet');
			var parts = [];
			parts.push(h.singbox_running ? _('sing-box: running') : _('sing-box: not running'));
			parts.push(h.monitor_running ? _('monitor: running') : _('monitor: not running'));
			if (h.config_present)
				parts.push(h.config_valid ? _('config: valid') : _('config: invalid'));
			else
				parts.push(_('config: not generated'));
			if (h.nft_rules != null) parts.push(_('nftables rules') + ': ' + h.nft_rules);
			if (h.devices != null) parts.push(_('device policies') + ': ' + h.devices);
			if (h.nodes && h.nodes.total != null)
				parts.push(_('nodes online') + ': ' + h.nodes.ok + '/' + h.nodes.total);
			return parts.join(' · ');
		}
		function healthAlerts(h) {
			var alerts = [];
			if (h && h.singbox_running === 0 && h.config_present)
				alerts.push(_('sing-box is not running: the gateway cannot route the tunnel. Check logread -e wificalling-gateway.'));
			if (h && h.config_stale)
				alerts.push(_('The configuration changed but the gateway was not restarted: sing-box still runs the previous config. Restart the service to apply it.'));
			if (h && h.config_present && h.config_valid === 0)
				alerts.push(_('The generated sing-box config failed validation.'));
			return alerts;
		}
		var healthBox = E('div', { class: 'cbi-section' }, []);
		function renderHealth(value) {
			var h = parseHealth(value);
			var alerts = healthAlerts(h);
			dom.content(healthBox, [
				E('h3', {}, _('Service status')),
				E('p', {}, healthText(h)),
				alerts.length ? E('ul', {}, alerts.map(function(a) { return E('li', { class: 'alert-message warning' }, a); })) : null
			]);
		}
		renderHealth(healthRaw);
		poll.add(function() {
			return L.resolveDefault(fs.read('/var/run/wificalling-gateway/service-health.json'), '{}').then(renderHealth);
		}, 30);

		/* ---------- 设备隧道状态 ---------- */
		function rows(source) {
			return (source.devices || []).map(function(d) {
				var values = [d.label, d.ip, wfcLabel(d.wificalling || d.state), d.node || '-', d.epdg_ip || '-',
					(d.ike_seen ? '500' : '-') + ' / ' + (d.nat_t_seen ? '4500' : '-'),
					d.assured ? _('Yes') : _('No'), d.sent_packets + ' ↑ / ' + d.reply_packets + ' ↓', when(d.last_activity)];
				return E('tr', { class: 'tr' }, values.map(function(x) { return E('td', { class: 'td' }, String(x)); }));
			});
		}
		var body = E('tbody', {}, rows(parse(data[0])));
		poll.add(function() { return L.resolveDefault(fs.read('/var/run/wificalling-gateway/status.json'), '{}').then(function(v) { dom.content(body, rows(parse(v))); }); }, 5);
		return E([], [E('h2', {}, _('Wi-Fi Calling status')), E('p', {}, _('Registered means an ASSURED bidirectional UDP 4500 tunnel was observed. This is network evidence, not carrier activation confirmation.')),
			healthBox,
			E('div', { class: 'table cbi-section-table' }, [E('table', { class: 'table' }, [
				E('tr', { class: 'tr table-titles' }, [_('Device'), _('IP'), _('Wi-Fi Calling status'), _('Node'), _('ePDG IP'), _('UDP 500/4500'), _('ASSURED'), _('Packets'), _('Last activity')].map(function(x) { return E('th', { class: 'th' }, x); })), body
			])])]);
	}
});
