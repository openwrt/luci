'use strict';
'require form';
'require network';

return network.registerProtocol('dhcpv6', {
	getI18n: function() {
		return _('DHCPv6 client');
	},

	getPackageName: function() {
		return 'odhcp6c';
	},

	renderFormOptions: function(s) {
		var o;

		o = s.taboption('general', form.ListValue, 'reqaddress', _('Request IPv6-address'));
		o.value('try', _('try', 'DHCPv6 address request mode'));
		o.value('force', _('force', 'DHCPv6 address request mode'));
		o.value('none', _('disabled', 'DHCPv6 address request mode'));
		o.default = 'try';
		o = s.taboption('general', form.Value, 'reqprefix', _('Request IPv6-prefix'),
			_('Either a prefix length hint (e.g. 56) only, whereby the operator selects the prefix, or specify a prefix also (e.g. %s)')
			.format('<code>2001:db8::/56</code>'));
		o.value('auto', _('Automatic'));
		o.value('no', _('disabled'));
		o.value('48');
		o.value('52');
		o.value('56');
		o.value('60');
		o.value('64');
		o.default = 'auto';

		o = s.taboption('general', form.Flag, 'extendprefix', _('Extend prefix'), _('Extend 3GPP WAN interface /64 prefix via PD to LAN (RFC 7278)'));

		o = s.taboption('general', form.Flag, 'norelease', _('Do not send a Release when restarting'),
						_('Enable to minimise the chance of prefix change after a restart'));
		o.default = '1';
		o.rmempty = false;

		o = s.taboption('advanced', form.Value, 'clientid', _('Client ID to send when requesting DHCP'));
		o.datatype  = 'hexstring';
	}
});
