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

		o = s.taboption('general', form.Flag, 'defaultreqopts', _('Request all known DHCPv6 options'));
		o.rmempty = false;
		o.default = '0';

		o = s.taboption('general', form.MultiValue, 'reqopts', _('Request Specific DHCPv6 Options'));
		o.depends('defaultreqopts', '0');
		o.widget = 'checkbox';
		o.multiple = true;
		o.value('21', 'SIP Server Domain Name List (21)');
		o.value('22', 'SIP Servers IPv6 Address List (22)');
		o.value('23', 'DNS Recursive Name Server (23)');
		o.value('24', 'Domain Search List (24)');
		o.value('31', 'Simple NTP Server (31)');
		o.value('56', 'NTP Server (56)');
		o.value('64', 'DS-Lite AFTR Name (64)');
		o.value('94', 'MAP-E (94)');
		o.value('95', 'MAP-T (95)');
		o.value('96', 'LW4over6 (96)');
		o.default = '21 22 23 24 31 56';

		o = s.taboption('advanced', form.Value, 'clientid', _('Client ID to send when requesting DHCP'));
		o.datatype  = 'hexstring';

		o = s.taboption('advanced', form.Flag, 'norelease', _('Do not send a Release when restarting'),
						_('Enable to minimise the chance of prefix change after a restart'));
		o.default = '0';
	}
});
