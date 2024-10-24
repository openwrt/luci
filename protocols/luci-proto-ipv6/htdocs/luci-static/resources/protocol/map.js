'use strict';
'require form';
'require network';
'require tools.widgets as widgets';

network.registerPatternVirtual(/^map-.+$/);
network.registerErrorCode('INVALID_MAP_RULE', _('MAP rule is invalid'));
network.registerErrorCode('NO_MATCHING_PD',   _('No matching prefix delegation'));
network.registerErrorCode('UNSUPPORTED_TYPE', _('Unsupported MAP type'));

return network.registerProtocol('map', {
	getI18n: function() {
		return _('MAP / LW4over6');
	},

	getIfname: function() {
		return this._ubus('l3_device') || 'map-%s'.format(this.sid);
	},

	getOpkgPackage: function() {
		return 'map-t';
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

	getGatewayAddr: function () {
		return this.get('peeraddr');
	},

	getIPv6Addrs: function () {
		var d = this._ubus('data');
		if (L.isObject(d) && typeof (d.ipv6addr) == 'string')
			return d.ipv6addr;
		return null;
	},

	callShowPortsets: function () {
		var d = this._ubus('data');
		if (L.isObject(d) && typeof (d.portsets) == 'string') {
			var portSets = d.portsets;
			if (portSets) {
				var portArray = portSets.split(' ');
				var groupedPorts = [];
				for (var i = 0; i < portArray.length; i += 2) {
					groupedPorts.push(portArray.slice(i, i + 2));
				}
				portSets = E('table', { style: 'width: 100%; border-collapse: collapse;' },
					groupedPorts.map(function (portGroup) {
						return E('tr', {}, [
							E('td', { style: 'padding: 10px; border: 1px solid #ddd; text-align: center; font-size: 16px;' }, portGroup[0]),
							portGroup[1] ? E('td', { style: 'padding: 10px; border: 1px solid #ddd; text-align: center; font-size: 16px;' }, portGroup[1]) : E('td', {})
						]);
					})
				);
			}
			function showPortsets() {
				L.ui.showModal(_('Available portsets'), [
					E('div', { style: 'max-height: 400px; overflow-y: auto; padding: 10px; border: 1px solid #ddd;' }, portSets || _('No Data')),
					E('div', { class: 'right' }, [
						E('button', {
							class: 'btn',
							click: L.ui.hideModal
						}, _('Close'))
					])
				]);
			}
			return showPortsets;
		}
		return null;
	},

	renderFormOptions: function(s) {
		var o;

		o = s.taboption('general', form.ListValue, 'maptype', _('Type'));
		o.value('map-e', 'MAP-E');
		o.value('map-t', 'MAP-T');
		o.value('lw4o6', 'LW4over6');

		o = s.taboption('general', form.Value, 'peeraddr', _('BR / DMR / AFTR'));
		o.rmempty  = false;
		o.datatype = 'ip6addr';

		o = s.taboption('general', form.Value, 'ipaddr', _('IPv4 prefix'));
		o.datatype = 'ip4addr';

		o = s.taboption('general', form.Value, 'ip4prefixlen', _('IPv4 prefix length'), _('The length of the IPv4 prefix in bits, the remainder is used in the IPv6 addresses.'));
		o.placeholder = '32';
		o.datatype    = 'range(0,32)';

		o = s.taboption('general', form.Value, 'ip6prefix', _('IPv6 prefix'), _('The IPv6 prefix assigned to the provider, usually ends with <code>::</code>'));
		o.rmempty  = false;
		o.datatype = 'ip6addr';

		o = s.taboption('general', form.Value, 'ip6prefixlen', _('IPv6 prefix length'), _('The length of the IPv6 prefix in bits'));
		o.placeholder = '16';
		o.datatype    = 'range(0,64)';

		o = s.taboption('general', form.Value, 'ealen', _('EA-bits length'));
		o.datatype = 'range(0,48)';

		o = s.taboption('general', form.Value, 'psidlen', _('PSID-bits length'));
		o.datatype = 'range(0,16)';

		o = s.taboption('general', form.Value, 'offset', _('PSID offset'));
		o.datatype = 'range(0,16)';

		o = s.taboption('advanced', widgets.NetworkSelect, 'tunlink', _('Tunnel Link'));
		o.nocreate = true;
		o.exclude  = s.section;

		o = s.taboption('advanced', form.Value, 'ttl', _('Use TTL on tunnel interface'));
		o.placeholder = '64';
		o.datatype    = 'range(1,255)';

		o = s.taboption('advanced', form.Value, 'mtu', _('Use MTU on tunnel interface'));
		o.placeholder = '1280';
		o.datatype    = 'max(9200)';

		o = s.taboption('advanced', form.Flag, 'legacymap', _('Use legacy MAP'), _('Use legacy MAP interface identifier format (draft-ietf-softwire-map-00) instead of RFC7597'));

		o = s.taboption('advanced', form.Flag, 'snat_fix', _('Enable SNAT fix'), _('Apply SNAT fixes with certain ISPs'));

		o = s.taboption('advanced', form.Value, 'dont_snat_to', _('Exclude SNAT ports'), _('List of ports to exclude from SNAT. Separate ports with spaces'));
		o.depends('snat_fix', '1');
		o.datatype = 'string';
		o.placeholder = '80 443 8080';
		o.validate = function (section_id, value) {
			value = value.trim().replace(/\s+/g, ' ');
			if (!value) return true;
			let seen = new Set();
			for (let port of value.split(' ')) {
				let portNum = parseInt(port, 10);
				if (!/^\d+$/.test(port) || portNum < 1 || portNum > 65535) {
					return _('Expecting: %s').format(_('valid port value'));
				}
				if (seen.has(port)) {
					return _('Duplicate port found:') + port;
				}
				seen.add(port);
			}
			return true;
		};
		o.write = function (section_id, form_value) {
			return this.super('write', [section_id, form_value.trim().replace(/\s+/g, ' ')]);
		};
	}
});
