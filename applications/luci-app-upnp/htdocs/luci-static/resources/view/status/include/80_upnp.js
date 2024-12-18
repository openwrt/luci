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

function padnum(num, length) {
	num = num.toString();
	while (num.length < length) num = "0" + num;
	return num;
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
				E('th', { 'class': 'th' }, _('Expires')),
				E('th', { 'class': 'th' }, _('Description')),
				E('th', { 'class': 'th cbi-section-actions' }, '')
			])
		]);

		var rules = Array.isArray(data[0].rules) ? data[0].rules : [];

		var rows = rules.map(function(rule) {
			var expires_sec, hour, minute, second, expires_str = '';
			expires_sec = (new Date(rule.expires * 1000) - new Date().getTime()) / 1000;
			hour = Math.floor(expires_sec / 3600);
			minute = Math.floor(expires_sec % 3600 / 60);
			second = Math.floor(expires_sec % 60);
			if (hour >= 1) {
				expires_str += hour + 'h ';
				expires_str += padnum(minute, 2) + 'm ';
				expires_str += padnum(second, 2) + 's';
			} else if (minute >= 1) {
				expires_str += minute + 'm ';
				expires_str += padnum(second, 2) + 's';
			} else if (expires_sec >= 1) expires_str += second + 's';

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
