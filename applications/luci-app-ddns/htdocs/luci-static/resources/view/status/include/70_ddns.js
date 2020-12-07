'use strict';
'require baseclass';
'require rpc';
'require uci';

return baseclass.extend({
	title: _('Dynamic DNS'),

	callDDnsGetServicesStatus: rpc.declare({
		object: 'luci.ddns',
		method: 'get_services_status',
		expect: {  }
	}),

	load: function() {
		return Promise.all([
			this.callDDnsGetServicesStatus(),
			uci.load('ddns')
		]);
	},

	render: function(data) {
		var services = data[0];

		var table = E('table', { 'class': 'table' }, [
			E('tr', { 'class': 'tr table-titles' }, [
				E('th', { 'class': 'th' }, _('Configuration')),
				E('th', { 'class': 'th' }, _('Next Update')),
				E('th', { 'class': 'th' }, _('Lookup Hostname')),
				E('th', { 'class': 'th' }, _('Registered IP')),
				E('th', { 'class': 'th' }, _('Network'))
			])
		]);

		cbi_update_table(table, Object.keys(services).map(function(key, index) {
			return [
				key,
				services[key].next_update ? _(services[key].next_update) : _('Unknown'),
				uci.get('ddns',key,'lookup_host'),
				services[key].ip ? services[key].ip : _('No Data'),
				(uci.get('ddns',key,'use_ipv6') == '1' ? 'IPv6' : 'IPv4') + ' / ' + uci.get('ddns',key,'interface')
			];
		}), E('em', _('There is no service configured.')));

		return E([table]);
	}
});
