'use strict';
'require view';
'require fs';
'require poll';
'require dom';

return view.extend({
	load: function() { return L.resolveDefault(fs.read('/var/run/wificalling-gateway/status.json'), '{}'); },
	render: function(raw) {
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
		function rows(source) {
			return (source.devices || []).map(function(d) {
				var values = [d.label, d.ip, wfcLabel(d.wificalling || d.state), d.node || '-', d.epdg_ip || '-',
					(d.ike_seen ? '500' : '-') + ' / ' + (d.nat_t_seen ? '4500' : '-'),
					d.assured ? _('Yes') : _('No'), d.sent_packets + ' ↑ / ' + d.reply_packets + ' ↓', when(d.last_activity)];
				return E('tr', { class: 'tr' }, values.map(function(x) { return E('td', { class: 'td' }, String(x)); }));
			});
		}
		var body = E('tbody', {}, rows(parse(raw)));
		poll.add(function() { return L.resolveDefault(fs.read('/var/run/wificalling-gateway/status.json'), '{}').then(function(v) { dom.content(body, rows(parse(v))); }); }, 5);
		return E([], [E('h2', {}, _('Wi-Fi Calling status')), E('p', {}, _('Registered means an ASSURED bidirectional UDP 4500 tunnel was observed. This is network evidence, not carrier activation confirmation.')),
			E('div', { class: 'table cbi-section-table' }, [E('table', { class: 'table' }, [
				E('tr', { class: 'tr table-titles' }, [_('Device'), _('IP'), _('Wi-Fi Calling status'), _('Node'), _('ePDG IP'), _('UDP 500/4500'), _('ASSURED'), _('Packets'), _('Last activity')].map(function(x) { return E('th', { class: 'th' }, x); })), body
			])])]);
	}
});
