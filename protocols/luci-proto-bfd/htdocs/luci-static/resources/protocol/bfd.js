'use strict';
'require form';
'require network';
'require tools.widgets as widgets';

return network.registerProtocol('bfd', {
	getI18n: function() {
		return _('Bidirectional Forwarding Detection (BFD) Session');
	},

	getPackageName: function() {
		return 'proto-bfd';
	},

	renderFormOptions: function(s) {
		var o;
		var proto = this;

		// -- general ---------------------------------------------------------------------

		o = s.taboption('general', form.Value, 'peer_address', _("Remote IP address"), _("The IP address of the remote BFD peer."));
		o.rmempty = false;
		o.datatype = 'or(ip4addr("nomask"),ip6addr("nomask"))';

		o = s.taboption('general', form.Flag, 'multihop', _("Multihop"), _("Allow BFD packats to traverse multiple hops. Use when BFD peer is not a direct neighbour of this router."));

		o = s.taboption('general', form.Value, 'local_address', _("Local IPv4 address"), _("The local IP address used to communicate with the BFD peer (mandatory on multihop)."));
		o.rmempty = false;
		o.datatype = 'or(ip4addr("nomask"),ip6addr("nomask"))';
		o.depends('multihop', '1');
		o.load = function(section_id) {
			return network.getDevices().then(L.bind(function(devs) {
				var addrs = devs.flatMap(d => {
					var linkName = d.getName();
					function addLinkName(addr) {
						if (addr.startsWith("fe8")) {
							addr = addr + "%" + linkName;
						}
						return addr;
					}
					var addrs4 = d.getIPAddrs().map(a => a.split('/')[0]);
					var addrs6 = d.getIP6Addrs().map(a => a.split('/')[0]).map(addLinkName);
					return addrs4.concat(addrs6)
				}).sort()

				for (var i = 0; i < addrs.length; i++) {
					this.value(addrs[i]);
				}
				return form.Value.prototype.load.apply(this, [section_id]);
			}, this));
		};

		o = s.taboption('general', form.Value, 'vrf_name', _("VRF Name"), _("Optional. The VRF used to communicate with the BFD peer."));
		o.optional = true;
		o.datatype = 'string';
		o.depends('multihop', '1');

		// -- advanced ---------------------------------------------------------------------

		o = s.taboption('advanced', form.Value, 'detect_multiplier', _("Detect Multiplier"), _("Number of consecutive missed BFD packets after which the session is considered down."));
		o.optional = true;
		o.placeholder = 3;
		o.datatype = 'uinteger';

		o = s.taboption('advanced', form.Value, 'receive_interval', _("Receive Interval (ms)"), _("Minimum number of milliseconds between BFD packets we're willing to receive from the peer."));
		o.optional = true;
		o.placeholder = 300;
		o.datatype = 'uinteger';

		o = s.taboption('advanced', form.Value, 'transmit_interval', _("Transmit Interval (ms)"), _("Minimum number of milliseconds between BFD packet we transmit."));
		o.optional = true;
		o.placeholder = 300;
		o.datatype = 'uinteger';

		o = s.taboption('advanced', form.Flag, 'echo_mode', _("Echo Mode"), _("Echo mode sends packets with ourselves as destination, hoping the peer will reflect them without noticing."));

		o = s.taboption('advanced', form.Value, 'echo_interval', _("Echo Interval (ms)"), _("Minimum number of milliseconds between BFD Echo packets, both for transmitting and receiving/reflecting. Set to zero to tell our peer we don't want incoming echos."));
		o.optional = true;
		o.placeholder = 50;
		o.datatype = 'uinteger';
	}
});
