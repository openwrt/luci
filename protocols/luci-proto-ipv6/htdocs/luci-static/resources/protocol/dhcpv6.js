'use strict';
'require form';
'require network';

return network.registerProtocol('dhcpv6', {
	getI18n: function() {
		return _('DHCPv6 client');
	},

	getOpkgPackage: function() {
		return 'odhcp6c';
	},

	renderFormOptions: function(s) {
		var o;

		o = s.taboption('general', form.ListValue, 'reqaddress', _('Request IPv6-address'));
		o.value('try');
		o.value('force');
		o.value('none', 'disabled');
		o.default = 'try';

		o = s.taboption('general', form.Value, 'reqprefix', _('Request IPv6-prefix of length'));
		o.value('auto', _('Automatic'));
		o.value('no', _('disabled'));
		o.value('48');
		o.value('52');
		o.value('56');
		o.value('60');
		o.value('64');
		o.default = 'auto';

		o = s.taboption('advanced', form.Value, 'clientid', _('Client ID to send when requesting DHCP'));
		o.datatype  = 'hexstring';
	}
});
