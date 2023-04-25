'use strict';
'require form';
'require network';
'require tools.widgets as widgets';

network.registerPatternVirtual(/^gre6t-.+$/);

return network.registerProtocol('grev6tap', {
	getI18n: function() {
		return _('GRETAP tunnel over IPv6');
	},

	getIfname: function() {
		return this._ubus('l3_device') || 'gre6t-%s'.format(this.sid);
	},

	getOpkgPackage: function() {
		return 'gre';
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

		// -- general ---------------------------------------------------------------------

		o = s.taboption('general', form.Value, 'peer6addr', _("Remote IPv6 address or FQDN"), _("The IPv6 address or the fully-qualified domain name of the remote tunnel end."));
		o.optional = false;
		o.datatype = 'or(hostname,ip6addr("nomask"))';
		o.load = function(section_id) {
			return network.getWAN6Networks().then(L.bind(function(nets) {
				if (Array.isArray(nets) && nets.length)
					this.placeholder = nets[0].getIP6Addr();
				return form.Value.prototype.load.apply(this, [section_id]);
			}, this));
		};

		o = s.taboption('general', form.Value, 'ip6addr', _("Local IPv6 address"), _("The local IPv6 address over which the tunnel is created (optional)."));
		o.optional = true;
		o.datatype = 'ip6addr("nomask")';

		o = s.taboption('general', widgets.NetworkSelect, 'weakif', _("Source interface"), _("Logical network from which to select the local endpoint if local IPv6 address is empty and no WAN IPv6 is available (optional)."));
		o.exclude = s.section;
		o.nocreate = true;
		o.optional = true;

		o = s.taboption('general', widgets.NetworkSelect, 'network', _("Network interface"), _("Logical network to which the tunnel will be added (bridged) (optional)."));
		o.exclude = s.section;
		o.nocreate = true;
		o.optional = true;

		// -- advanced ---------------------------------------------------------------------

		o = s.taboption('advanced', widgets.NetworkSelect, 'tunlink', _("Bind interface"), _("Bind the tunnel to this interface (optional)."));
		o.exclude = s.section;
		o.nocreate = true;
		o.optional = true;

		o = s.taboption('advanced', form.Value, 'mtu', _("Override MTU"), _("Specify an MTU (Maximum Transmission Unit) other than the default (1280 bytes) (optional)."));
		o.optional = true;
		o.placeholder = 1280;
		o.datatype = 'range(68, 9200)';

		o = s.taboption('advanced', form.Value, 'ttl', _("Override TTL"), _("Specify a TTL (Time to Live) for the encapsulating packet other than the default (64) (optional)."));
		o.optional = true;
		o.placeholder = 64;
		o.datatype = 'min(1)';

		o = s.taboption('advanced', form.Value, 'tos', _("Traffic Class"), _("Specify a Traffic Class. Can be <code>inherit</code> (the outer header inherits the value of the inner header) or an hexadecimal value <code>00..FF</code> (optional)."));
		o.optional = true;
		o.validate = function(section_id, value) {
			if (value.length > 0 && !value.match(/^[a-f0-9]{1,2}$/i) && !value.match(/^inherit$/i))
				return _("Invalid Traffic Class value, expected 00..FF or inherit");

			return true;
		};

		o = s.taboption('advanced', form.Flag, 'nohostroute', _("No host route"), _("Do not create host route to peer (optional)."));
		o.optional = true;

		o = s.taboption('advanced', form.Flag, 'multicast', _("Multicast"), _("Enable support for multicast traffic (optional)."));
		o.optional = true;

		o = s.taboption('advanced', form.Value, 'ikey', _("Incoming key"), _("Key for incoming packets (optional)."));
		o.optional = true;
		o.datatype = 'integer';

		o = s.taboption('advanced', form.Value, 'okey', _("Outgoing key"), _("Key for outgoing packets (optional)."));
		o.optional = true;
		o.datatype = 'integer';

		s.taboption('advanced', form.Flag, 'icsum', _("Incoming checksum"), _("Require incoming checksum (optional)."));
		s.taboption('advanced', form.Flag, 'ocsum', _("Outgoing checksum"), _("Compute outgoing checksum (optional)."));
		s.taboption('advanced', form.Flag, 'iseqno', _("Incoming serialization"), _("Require incoming packets serialization (optional)."));
		s.taboption('advanced', form.Flag, 'oseqno', _("Outgoing serialization"), _("Perform outgoing packets serialization (optional)."));

	}
});
