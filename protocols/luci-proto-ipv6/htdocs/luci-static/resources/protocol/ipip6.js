'use strict';
'require form';
'require network';
'require tools.widgets as widgets';

network.registerPatternVirtual(/^ipip6-.+$/);

return network.registerProtocol('ipip6', {
	getI18n: function () {
		return _('IPv4 over IPv6 (RFC2473-IPIPv6)');
	},

	getIfname: function () {
		return this._ubus('l3_device') || 'ipip6-%s'.format(this.sid);
	},

	getPackageName: function () {
		return 'ds-lite';
	},

	isFloating: function () {
		return true;
	},

	isVirtual: function () {
		return true;
	},

	getDevices: function () {
		return null;
	},

	containsDevice: function (ifname) {
		return (network.getIfnameOf(ifname) == this.getIfname());
	},

	renderFormOptions: function (s) {
		var o;

		o = s.taboption('general', form.Value, 'peeraddr', _('Remote IPv6 address or FQDN'));
		o.rmempty = false;
		o.datatype = 'or(hostname,ip6addr("nomask"))';

		o = s.taboption('general', form.Value, 'ip4ifaddr', _('Local IPv4 address'));
		o.rmempty = false;
		o.datatype = 'ip4addr("nomask")';

		o = s.taboption('general', form.Value, 'ip6addr', _('Local IPv6 address'), _('Leave empty to use the current WAN address'));
		o.datatype = 'ip6addr("nomask")';
		o.load = function (section_id) {
			return network.getWAN6Networks().then(L.bind(function (nets) {
				if (Array.isArray(nets) && nets.length)
					this.placeholder = nets[0].getIP6Addr();
				return form.Value.prototype.load.apply(this, [section_id]);
			}, this));
		};

		o = s.taboption('advanced', widgets.NetworkSelect, 'tunlink', _('Tunnel Link'));
		o.nocreate = true;
		o.exclude = s.section;

		o = s.taboption('advanced', form.ListValue, 'encaplimit', _('Encapsulation limit'));
		o.rmempty = false;
		o.default = 'ignore';
		o.datatype = 'or("ignore",range(0,255))';
		o.value('ignore', _('ignore'));
		for (var i = 0; i < 256; i++)
			o.value(i);

		o = s.taboption('advanced', form.Flag, 'defaultroute', _('Default gateway'), _('If unchecked, no default route is configured'));
		o.default = o.enabled;

		o = s.taboption('advanced', form.Value, 'metric', _('Use gateway metric'));
		o.placeholder = '0';
		o.datatype = 'uinteger';
		o.depends('defaultroute', '1');

		o = s.taboption('advanced', form.Value, 'mtu', _('Use MTU on tunnel interface'));
		o.placeholder = '1280';
		o.datatype = 'max(9200)';
	}
});
