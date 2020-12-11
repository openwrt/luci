'use strict';
'require baseclass';
'require form';

return baseclass.extend({
	title: _('DHCP Leases Plugin Configuration'),
	description: _('The dhcpleases plugin collects information about assigned DHCP leases.'),

	addFormOptions: function(s) {
		var o;

		o = s.option(form.Flag, 'enable', _('Enable this plugin'));

		o = s.option(form.Value, 'Path', _('DHCP leases file'));
		o.default = '/tmp/dhcp.leases';
	},

	configSummary: function(section) {
		return _('Monitoring DHCP leases enabled');
	}
});
