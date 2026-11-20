'use strict';
'require form';
'require network';

network.registerPatternVirtual(/^sstp-.+$/);

return network.registerProtocol('sstp', {
	getI18n: function() {
		return _('SSTP');
	},

	getIfname: function() {
		return this._ubus('l3_device') || 'sstp-%s'.format(this.sid);
	},

	getPackageName: function() {
		return 'sstp-client';
	},

	isFloating: function() {
		return true;
	},

	isVirtual: function() {
		return true;
	},

	getDevices: function() {
		return null;
	},

	containsDevice: function(ifname) {
		return (network.getIfnameOf(ifname) == this.getIfname());
	},

	renderFormOptions: function(s) {
		var dev = this.getL3Device() || this.getDevice(), o;

		// -- general ---------------------------------------------------------------------

		o = s.taboption('general', form.Value, 'server', _('SSTP Server'));
		o.datatype = 'host';

		o = s.taboption('general', form.Value, 'port', _('SSTP Port'));
		o.placeholder = '443';
		o.datatype = 'port';

		o = s.taboption('general', form.Value, 'username', _('PAP/CHAP username'));

		o = s.taboption('general', form.Value, 'password', _('PAP/CHAP password'));
		o.password = true;

		// -- advanced --------------------------------------------------------------------

		o = s.taboption('advanced', form.Flag, 'ppp_ipv6', _('IPv6 support'), _('If checked, adds "+ipv6" to the pppd options'));
		o.ucioption = 'ipv6';

		o = s.taboption('advanced', form.ListValue, 'log_level', _('sstpc Log-level'));
		o.value('0', _('0', 'sstp log level value'));
		o.value('1', _('1', 'sstp log level value'));
		o.value('2', _('2', 'sstp log level value'));
		o.value('3', _('3', 'sstp log level value'));
		o.value('4', _('4', 'sstp log level value'));
		o.default = '0';

		o = s.taboption('advanced', form.Value, 'mtu', _('Override MTU'));
		o.placeholder = dev ? (dev.getMTU() || '1500') : '1500';
		o.datatype    = 'max(9200)';

		o = s.taboption('advanced', form.Value, 'sstp_options', _('Extra sstpc options'), _('e.g: --proxy 10.10.10.10'));

		o = s.taboption('advanced', form.Value, 'pppd_options', _('Extra pppd options'), _('e.g: dump'));
	}
});
