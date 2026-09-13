'use strict';
'require form';
'require network';
'require tools.widgets as widgets';

network.registerPatternVirtual(/^vti-.+$/);

return network.registerProtocol('vti', {
	getI18n: function() {
		return _('VTI');
	},

	getIfname: function() {
		return this._ubus('l3_device') || 'vti-%s'.format(this.sid);
	},

	getPackageName: function() {
		return 'vti';
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

		o = s.taboption('general', form.Value, 'peeraddr', _("Remote IPv4 address or FQDN"), _("The IPv4 address or the fully-qualified domain name of the remote tunnel end."));
		o.optional = false;
		o.datatype = 'or(hostname,ip4addr("nomask"))';

		o = s.taboption('general', form.Value, 'ipaddr', _("Local IPv4 address"), _("The local IPv4 address over which the tunnel is created (optional)."));
		o.optional = true;
		o.datatype = 'ip4addr("nomask")';
		o.load = function(section_id) {
			return network.getWANNetworks().then(L.bind(function(nets) {
			if (nets.length)
				this.placeholder = nets[0].getIPAddr();
			return form.Value.prototype.load.apply(this, [section_id]);
			}, this));
		};

		o = s.taboption('general', form.Value, 'mtu', _('Override MTU'));
		o.placeholder = dev ? (dev.getMTU() || '1280') : '1280';
		o.datatype    = 'max(1500)';

		o = s.taboption('general', widgets.NetworkSelect, 'tunlink', _("Bind interface"), _("Bind the tunnel to this interface (optional)."));
		o.exclude = s.section;
		o.nocreate = true;
		o.optional = true;

		o = s.taboption('general', form.Value, 'ikey', _("Incoming key"), _("Key for incoming packets (optional)."));
		o.optional = true;
		o.datatype = 'uinteger';

		o = s.taboption('general', form.Value, 'okey', _("Outgoing key"), _("Key for outgoing packets (optional)."));
		o.optional = true;
		o.datatype = 'uinteger';
	}
});
