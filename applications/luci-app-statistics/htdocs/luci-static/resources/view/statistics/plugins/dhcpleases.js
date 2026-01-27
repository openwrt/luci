'use strict';
'require baseclass';
'require form';
'require statistics.pluginUtil as pluginUtil';

return baseclass.extend({
	title: _('DHCP Leases Plugin Configuration'),
	description: _('The dhcpleases plugin collects information about assigned DHCP leases.'),

	addFormOptions: function(s) {
		var o;

		pluginUtil.addCommonOptions(s);

		o = s.option(form.Value, 'Path', _('DHCP leases file'));
		o.default = '/tmp/dhcp.leases';
	},

	configSummary: function(section) {
		return _('Monitoring DHCP leases enabled');
	}
});
