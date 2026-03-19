'use strict';
'require form';
'require network';
'require tools.widgets as widgets';
'require uci';

network.registerPatternVirtual(/^vxlan-.+$/);

return network.registerProtocol('vxlan', {
	getI18n: function() {
		return _('VXLAN (RFC7348)');
	},

	getIfname: function() {
		return this._ubus('l3_device') || 'vxlan-%s'.format(this.sid);
	},

	getPackageName: function() {
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

		o = s.taboption('general', form.Value, 'peeraddr', _('Remote IPv4 address'), _('The IPv4 address or the fully-qualified domain name of the remote end.') + '<br/>' +
			_('Alternatively, a multicast address to reach a group of peers.') + '<br/>' +
			_('Remote VTEP'));
		o.optional = false;
		o.datatype = 'or(hostname,ip4addr("nomask"))';

		o = s.taboption('general', form.Value, 'ipaddr', _('Local IPv4 address'), _('The local IPv4 address over which the tunnel is created (optional).') + '<br/>' +
			_('Local VTEP'));
		o.optional = true;
		o.datatype = 'ip4addr("nomask")';

		o = s.taboption('general', form.Value, 'port', _('Destination port'));
		o.optional = true;
		o.placeholder = 4789;
		o.datatype = 'port';

		o = s.taboption('general', form.Value, 'srcport', _('Source port range'));
		o.optional = true;
		o.placeholder = '5000-6000';
		o.datatype = 'portrange';
		o.load = function(section_id) {
			const min = uci.get('network', section_id, 'srcportmin');
			const max = uci.get('network', section_id, 'srcportmax');
			if (!min || !max)
				return null;
			return `${min}-${max}`;
		};
		o.write = function(section_id, value) {
			const ports = value?.split('-') || null;
			if (ports){
				uci.set('network', section_id, 'srcportmin', ports[0]);
				uci.set('network', section_id, 'srcportmax', ports[1]);
			}
		};

		o = s.taboption('advanced', form.Value, 'ageing', _('Ageing'),
			_('FDB entry lifetime') + '<br/>' +
			_('Units: seconds'));
		o.optional = true;
		o.placeholder = 300;
		o.datatype = 'uinteger';

		o = s.taboption('advanced', form.Value, 'mtu', _('MTU'),
			_('Ensure MTU does not exceed that of parent interface') + '<br/>' +
			_('The VXLAN header adds 50 bytes of IPv4 encapsulation overhead, 74 bytes for IPv6.'));
		o.optional = true;
		o.placeholder = 1280;
		o.datatype = 'min(128)';

		o = s.taboption('advanced', form.Value, 'maxaddress', _('Max FDB size'),
			_('Maximum number of FDB entries'));
		o.optional = true;
		o.placeholder = 1000;
		o.datatype = 'min(1)';

		o = s.taboption('general', form.Flag, 'learning', _('Learning'),
			_('Automatic mac learning using multicast; inserts unknown source link layer addresses and IP addresses into the VXLAN device %s')
				.format('<abbr title="%s">%s</abbr>'.format(_('Forwarding DataBase'), _('FDB'))));
		o.optional = true;
		o.default = '1';
		o.rmempty = false;

		o = s.taboption('advanced', form.Flag, 'rsc', _('Route short-circuit (RSC)'),
			_('If destination MAC refers to router, replace it with destination MAC address'));
		o.optional = true;

		o = s.taboption('advanced', form.Flag, 'proxy', _('ARP proxy'),
			_('Reply on Neighbour request when mapping found in VXLAN FDB'));
		o.optional = true;

		o = s.taboption('advanced', form.Flag, 'l2miss', _('l2miss: Layer 2 miss'),
			_('On a l2miss, send ARP') + '<br/>' +
			_('Emits netlink LLADDR miss notifications') + '<br/>' +
			_('Expect netlink reply to add MAC address into VXLAN FDB'));
		o.optional = true;

		o = s.taboption('advanced', form.Flag, 'l3miss', _('l3miss: Layer 3 miss'),
			_('On a l3miss, send ARP for IP -> mac resolution') + '<br/>' +
			_('Emits netlink IP ADDR miss notifications') + '<br/>' + 
			_('Expect netlink reply to add destination IP address into Neighbour table'));
		o.optional = true;

		o = s.taboption('advanced', form.Flag, 'gbp', _('GBP'),
			_('Group Based Policy (VXLAN-GBP) extension'));
		o.optional = true;

		o = s.taboption('general', form.Value, 'vid', _('VXLAN network identifier'),
			_('VNI') + ': ' + _('ID used to identify the VXLAN uniquely'));
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
		// values 0xA0-0xE0 are valid, but don't work
		o.value('2', '2: 0x02');
		o.value('4', '4: 0x04');
		for (var i = 32; i <= 152; i += 8) {
			o.value(i, i + ': 0x' + i.toString(16).padStart(2, '0'));
		}
		o.value('inherit');
		o.validate = function(section_id, value) {
			if (!value || /^inherit$/.test(value)) return true;
			const v = parseInt(value)
			if (v % 4 != 0) return false
			if (v <= 152 && v > 0)
				return true;
			return false;
		};
		o.write = function(section_id, value) {
			if (!value) return
			value = value === 'inherit' ? value : parseInt(value).toString(16).padStart(2, '0');
			return uci.set('network', section_id, 'tos', value);
		};
		o.load = function(section_id) {
			const value = uci.get('network', section_id, 'tos');
			return value ? (value === 'inherit' ? value : parseInt(value, 16).toString()) : null;
		};

		o = s.taboption('advanced', form.Flag, 'rxcsum', _('Enable rx checksum'));
		o.optional = true;
		o.default = o.enabled;

		o = s.taboption('advanced', form.Flag, 'txcsum', _('Enable tx checksum'));
		o.optional = true;
		o.default = o.enabled;

		try {
			s.tab('peers', _('Additional Peers'), _('Further information about VXLAN interfaces and peers %s.').format('<a href=\'https://openwrt.org/docs/guide-user/network/tunneling_interface_protocols#protocol_vxlan_vxlan_layer_2_virtualization_over_layer_3_network\'>here</a>'));
		}
		catch(e) {}

		o = s.taboption('peers', form.SectionValue, '_peers', form.GridSection, 'vxlan_peer');
		o.depends('proto', 'vxlan');

		var ss = o.subsection;
		ss.anonymous = true;
		ss.addremove = true;
		ss.addbtntitle = _('Add peer');
		ss.nodescriptions = true;
		ss.modaltitle = _('Edit peer');
		ss.filter = function(section_id) {
			let peer = uci.get('network', section_id);
			return (peer.vxlan === s.section ? true: false);
		};

		o = ss.option(form.Value, 'description', _('Description'), _('Optional. Description of peer.'));
		o.placeholder = _('My Peer');
		o.datatype = 'string';
		o.optional = true;

		o = ss.option(form.Value, 'lladr', _('Layer 2 Address'),
			_('L2 (MAC) address of peer. Uses source-address learning when %s is specified')
			.format('<code>00:00:00:00:00:00</code>'));
		o.editable = true;
		o.datatype = 'macaddr';
		o.optional = true;
		o.modalonly = true;
		o.value('00:00:00:00:00:00');

		o = ss.option(form.Value, 'dst', _('Peer IP'), _('IP address of the remote VXLAN tunnel endpoint where the MAC address (Layer 2 Address) resides or a multicast address for a group of peers.')
			+ '<br/>' + _('For multicast, an outgoing interface (%s) needs to be specified').format('<code>via</code>'));
		o.editable = true;
		o.datatype = 'ipaddr';
		o.placeholder = '239.1.1.1'
		o.rmempty = false;
		o.write = function(section_id, value) {
			// Note: a heavier alternative is to chain vxlan parameter creation to handleAdd
			// but because ipaddr is also mandatory, use this write function
			uci.set('network', section_id, 'vxlan', s.section);
			return this.super('write', [ section_id, value ]);
		};

		o = ss.option(form.Value, 'port', _('Port'), _('UDP destination port number to use to connect to the remote VXLAN tunnel endpoint'));
		o.editable = true;
		o.datatype = 'port';
		o.placeholder = 4789;
		o.optional = true;

		o = ss.option(widgets.NetworkSelect, 'via', _('Via'), _('Name of the outgoing interface to reach the remote VXLAN tunnel endpoint'));
		o.editable = true;
		o.exclude = s.section;
		o.nocreate = true;
		o.optional = true;
		o.validate = function(section_id, value) {
			const dst = this.section.getOption('dst').formvalue(section_id).toLowerCase();
			const ipv4MulticastRegex = /^(22[4-9]|23[0-9])(\.\d{1,3}){3}$/;
			const ipv6MulticastRegex = /^ff[0-9a-fA-F]{0,2}:.*/;
			let isMulticastIP = ipv4MulticastRegex.test(dst) || ipv6MulticastRegex.test(dst);

			if (!value && isMulticastIP) {
				return _('Via shall be specified when %s is a multicast address').format(_('Peer IP'));
			}
			return true;
		};

		o = ss.option(form.Value, 'vni', _('VNI'), _('the VXLAN Network Identifier (or VXLAN Segment ID) to use to connect to the remote VXLAN tunnel endpoint'));
		o.editable = true;
		o.datatype = 'range(1, 16777216)';
		o.optional = true;

		o = ss.option(form.Value, 'src_vni', _('Source VNI'), _('the source VNI Network Identifier (or VXLAN Segment ID) this entry belongs to. Used only when the VXLAN device is in external or collect metadata mode '));
		o.editable = true;
		o.datatype = 'range(1, 16777216)';
		o.optional = true;

	}
});
