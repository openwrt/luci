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

	getOpkgPackage: function() {
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

		o = s.taboption('general', form.Value, 'username', _('PAP/CHAP username'));

		o = s.taboption('general', form.Value, 'password', _('PAP/CHAP password'));
		o.password = true;

		// -- advanced --------------------------------------------------------------------

		o = s.taboption('advanced', form.Flag, 'ipv6', _('IPv6 support'), _('If checked, adds "+ipv6" to the pppd options'));

		o = s.taboption('advanced', form.ListValue, 'log_level', _('sstpc Log-level'));
		o.value('0', _('0', 'sstp log level value'));
		o.value('1', _('1', 'sstp log level value'));
		o.value('2', _('2', 'sstp log level value'));
		o.value('3', _('3', 'sstp log level value'));
		o.value('4', _('4', 'sstp log level value'));
		o.default = '0';

		var defaultroute = s.taboption('advanced', form.Flag, 'defaultroute', _('Use default gateway'), _('If unchecked, no default route is configured'));
		defaultroute.default = defaultroute.enabled;

		o = s.taboption('advanced', form.Value, 'metric', _('Use gateway metric'));
		o.placeholder = '0';
		o.datatype    = 'uinteger';
		o.depends('defaultroute', defaultroute.enabled);

		o = s.taboption('advanced', form.Flag, 'peerdns', _('Use DNS servers advertised by peer'), _('If unchecked, the advertised DNS server addresses are ignored'));
		o.default = o.enabled;

		o = s.taboption('advanced', form.DynamicList, 'dns', _('Use custom DNS servers'));
		o.depends('peerdns', '0');
		o.datatype = 'ipaddr';
		o.cast     = 'string';

		o = s.taboption('advanced', form.Value, 'mtu', _('Override MTU'));
		o.placeholder = dev ? (dev.getMTU() || '1500') : '1500';
		o.datatype    = 'max(9200)';

		o = s.taboption('advanced', form.Value, 'sstp_options', _('Extra sstpc options'), _('e.g: --proxy 10.10.10.10'));

		o = s.taboption('advanced', form.Value, 'pppd_options', _('Extra pppd options'), _('e.g: dump'));
	}
});
