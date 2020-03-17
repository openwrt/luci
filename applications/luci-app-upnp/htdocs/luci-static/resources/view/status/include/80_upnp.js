'use strict';
'require rpc';
'require uci';

var callUpnpGetStatus, callUpnpDeleteRule, handleDelRule;

callUpnpGetStatus = rpc.declare({
	object: 'luci.upnp',
	method: 'get_status',
	expect: {  }
});

callUpnpDeleteRule = rpc.declare({
	object: 'luci.upnp',
	method: 'delete_rule',
	params: [ 'token' ],
	expect: { result : "OK" },
});

handleDelRule = function(num, ev) {
	L.dom.parent(ev.currentTarget, '.tr').style.opacity = 0.5;
	ev.currentTarget.classList.add('spinning');
	ev.currentTarget.disabled = true;
	ev.currentTarget.blur();
	callUpnpDeleteRule(num);
};

return L.Class.extend({
	title: _('Active UPnP Redirects'),

	index_id: 'upnp',

	load: function() {
		return Promise.all([
			callUpnpGetStatus(),
		]);
	},

	render: function(data) {

		var table = E('div', { 'class': 'table', 'id': 'upnp_status_table' }, [
			E('div', { 'class': 'tr table-titles' }, [
				E('div', { 'class': 'th' }, _('Protocol')),
				E('div', { 'class': 'th' }, _('External Port')),
				E('div', { 'class': 'th' }, _('Client Address')),
				E('div', { 'class': 'th' }, _('Host')),
				E('div', { 'class': 'th' }, _('Client Port')),
				E('div', { 'class': 'th' }, _('Description')),
				E('div', { 'class': 'th cbi-section-actions' }, '')
			])
		]);

		var rules = Array.isArray(data[0].rules) ? data[0].rules : [];

		var rows = rules.map(function(rule) {
			return [
				rule.proto,
				rule.extport,
				rule.intaddr,
				rule.host_hint || _('Unknown'),
				rule.intport,
				rule.descr,
				E('button', {
					'class': 'btn cbi-button-remove',
					'click': L.bind(handleDelRule, this, rule.num)
				}, [ _('Delete') ])
			];
		});

		cbi_update_table(table, rows, E('em', _('There are no active redirects.')));

		return table;
	}
});
