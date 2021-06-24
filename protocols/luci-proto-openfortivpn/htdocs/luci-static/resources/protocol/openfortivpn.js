'use strict';
'require rpc';
'require form';
'require network';
'require tools.widgets as widgets';

network.registerPatternVirtual(/^vpn-.+$/);


return network.registerProtocol('openfortivpn', {
	getI18n: function() {
		return _('OpenFortivpn');
	},

	getIfname: function() {
		return this._ubus('l3_device') || 'vpn-%s'.format(this.sid);
	},

	getOpkgPackage: function() {
		return 'openfortivpn';
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
		var o;

		o = s.taboption('general', form.Value, 'peeraddr', _('VPN Server'));
		o.datatype = 'host(0)';

		o = s.taboption('general', form.Value, 'port', _('VPN Server port'));
		o.placeholder = '443';
		o.datatype = 'port';
		o.optional = true;

		s.taboption("general", form.Value, "username", _("Username"));

		o = s.taboption('general', form.Value, 'password', _('Password'));
		o.password = true;

		o = s.taboption('advanced', widgets.NetworkSelect, 'tunlink', _('Bind interface'), _('Bind the tunnel to this interface (optional).'));
		o.exclude = s.section;
		o.nocreate = true;
		o.optional = true;

		o = s.taboption('advanced', form.Value, 'trusted_cert', _("VPN Server's certificate SHA1 hash"));
		o.datatype = 'and(hexstring,length(64))'
		o.optional = true;

		o = s.taboption('advanced', form.Flag, 'defaultroute', _('Use default gateway'), _('If unchecked, no default route is configured'));
		o.default = o.enabled;
		o.optional = true;

		o = s.taboption('advanced', form.Flag, 'peerdns', _('Use DNS servers advertised by peer'), _('If unchecked, the advertised DNS server addresses are ignored'));
		o.default = o.enabled;
		o.optional = true;

		o = s.taboption('advanced', form.Value, 'metric', _('Use gateway metric'));
		o.placeholder = '0';
		o.datatype = 'uinteger';
		o.optional = true;

		o = s.taboption("advanced", form.Value, 'local_ip', _("Local IP address"));
		o.placeholder = '192.168.0.5'
		o.dataype = 'ipaddr'
		o.optional = true;

	}
});
