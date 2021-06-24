'use strict';
'require form';
'require network';
'require tools.widgets as widgets';

network.registerPatternVirtual(/^vxlan-.+$/);

return network.registerProtocol('vxlan', {
	getI18n: function() {
		return _('VXLAN (RFC7348)');
	},

	getIfname: function() {
		return this._ubus('l3_device') || 'vxlan-%s'.format(this.sid);
	},

	getOpkgPackage: function() {
		return 'vxlan';
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

		o = s.taboption('general', form.Value, 'peeraddr', _('Remote IPv4 address'), _('The IPv4 address or the fully-qualified domain name of the remote end.'));
		o.optional = false;
		o.datatype = 'or(hostname,ip4addr("nomask"))';

		o = s.taboption('general', form.Value, 'ipaddr', _('Local IPv4 address'), _('The local IPv4 address over which the tunnel is created (optional).'));
		o.optional = true;
		o.datatype = 'ip4addr("nomask")';

		o = s.taboption('general', form.Value, 'port', _('Destination port'));
		o.optional = true;
		o.placeholder = 4789;
		o.datatype = 'port';

		o = s.taboption('general', form.Value, 'vid', _('VXLAN network identifier'), _('ID used to uniquely identify the VXLAN'));
		o.optional = true;
		o.datatype = 'range(1, 16777216)';

		o = s.taboption('general', widgets.NetworkSelect, 'tunlink', _('Bind interface'), _('Bind the tunnel to this interface (optional).'));
		o.exclude = s.section;
		o.nocreate = true;
		o.optional = true;

		o = s.taboption('advanced', form.Value, 'ttl', _('Override TTL'), _('Specify a TTL (Time to Live) for the encapsulating packet other than the default (64).'));
		o.optional = true;
		o.placeholder = 64;
		o.datatype = 'min(1)';

		o = s.taboption('advanced', form.Value, 'tos', _('Override TOS'), _('Specify a TOS (Type of Service).'));
		o.optional = true;
		o.datatype = 'range(0, 255)';

		o = s.taboption('advanced', form.Flag, 'rxcsum', _('Enable rx checksum'));
		o.optional = true;
		o.default = o.enabled;

		o = s.taboption('advanced', form.Flag, 'txcsum', _('Enable tx checksum'));
		o.optional = true;
		o.default = o.enabled;

	}
});
