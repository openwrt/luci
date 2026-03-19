'use strict';
'require baseclass';
'require dom';
'require rpc';
'require uci';

const callUpnpGetStatus = rpc.declare({
	object: 'luci.upnp',
	method: 'get_status',
	expect: {  }
});

const callUpnpDeleteRule = rpc.declare({
	object: 'luci.upnp',
	method: 'delete_rule',
	params: [ 'token' ],
	expect: { result : "OK" },
});

function handleDelRule(num, ev) {
	dom.parent(ev.currentTarget, '.tr').style.opacity = 0.5;
	ev.currentTarget.classList.add('spinning');
	ev.currentTarget.disabled = true;
	ev.currentTarget.blur();
	callUpnpDeleteRule(num);
}

return baseclass.extend({
	title: _('Active UPnP IGD & PCP/NAT-PMP Port Maps'),

	load: function() {
		return Promise.all([
			callUpnpGetStatus(),
		]);
	},

	render: function(data) {
		var table = E('table', { 'class': 'table', 'id': 'upnp_status_table' }, [
			E('tr', { 'class': 'tr table-titles' }, [
				E('th', { 'class': 'th' }, _('Client Name')),
				E('th', { 'class': 'th' }, _('Client Address')),
				E('th', { 'class': 'th' }, _('Client Port')),
				E('th', { 'class': 'th' }, _('External Port')),
				E('th', { 'class': 'th' }, _('Protocol')),
				E('th', { 'class': 'th right' }, _('Expires')),
				E('th', { 'class': 'th' }, _('Description')),
				E('th', { 'class': 'th cbi-section-actions' }, '')
			])
		]);

		var rules = Array.isArray(data[0].rules) ? data[0].rules : [];

		var rows = rules.map(function(rule) {
			const padnum = (num, length) => num.toString().padStart(length, "0");
			const expires_sec = rule?.expires || 0;
			const hour = Math.floor(expires_sec / 3600);
			const minute = Math.floor((expires_sec % 3600) / 60);
			const second = Math.floor(expires_sec % 60);
			const expires_str =
				hour > 0 ? `${hour}h ${padnum(minute, 2)}m ${padnum(second, 2)}s` :
				minute > 0 ? `${minute}m ${padnum(second, 2)}s` :
				expires_sec > 0 ? `${second}s` :
				'';

			return [
				rule.host_hint || _('Unknown'),
				rule.intaddr,
				rule.intport,
				rule.extport,
				rule.proto,
				expires_str,
				rule.descr,
				E('button', {
					'class': 'btn cbi-button-remove',
					'click': L.bind(handleDelRule, this, rule.num)
				}, [ _('Delete') ])
			];
		});

		cbi_update_table(table, rows, E('em', _('There are no active port maps.')));

		return table;
	}
});
