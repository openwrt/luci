'use strict';
'require uci';
'require form';
'require network';
'require tools.widgets as widgets';

network.registerPatternVirtual(/^relay-.+$/);

var RelayDevicePrototype = {
	__init__(ifname, network) {
		this.ifname  = ifname;
		this.network = network;
	},

	_aggregateDevices(fn, first) {
		const devices = this.network ? this.network.getDevices() : [];
		let rv = 0;

		for (let d of devices) {
			var v = d[fn].apply(d);

			if (v != null) {
				if (first)
					return v;

				rv += v;
			}
		}

		return first ? null : [ rv, devices.length ];
	},

	getPorts() { return this.network ? this.network.getDevices() : [] },

	getType() { return 'tunnel' },
	getTypeI18n() { return _('Relay Bridge') },

	getShortName() {
		return '%s "%h"'.format(_('Relay'), this.ifname);
	},

	isUp() {
		var res = this._aggregateDevices('isUp');
		return (res[1] > 0 && res[0] == res[1]);
	},

	getTXBytes() { return this._aggregateDevices('getTXBytes')[0] },
	getRXBytes() { return this._aggregateDevices('getRXBytes')[0] },
	getTXPackets() { return this._aggregateDevices('getTXPackets')[0] },
	getRXPackets() { return this._aggregateDevices('getRXPackets')[0] },

	getMAC() { return this._aggregateDevices('getMAC', true) },

	getIPAddrs() {
		var ipaddr = this.network ? L.toArray(uci.get('network', this.network.getName(), 'ipaddr'))[0] : null;
		return (ipaddr != null ? [ ipaddr ] : []);
	},

	getIP6Addrs() { return [] }
};

return network.registerProtocol('relay', {
	getI18n() {
		return _('Relay bridge');
	},

	getIfname() {
		return 'relay-%s'.format(this.sid);
	},

	getPackageName() {
		return 'relayd';
	},

	isFloating() {
		return true;
	},

	isVirtual() {
		return true;
	},

	containsDevice(ifname) {
		return (network.getIfnameOf(ifname) == this.getIfname());
	},

	isUp() {
		var dev = this.getDevice();
		return (dev ? dev.isUp() : false);
	},

	getDevice() {
		return network.instantiateDevice(this.sid, this, RelayDevicePrototype);
	},

	getDevices() {
		if (this.devices)
			return this.devices;

		const networkNames = L.toArray(uci.get('network', this.sid, 'network'));
		let deviceNames = L.toArray(uci.get('network', this.sid, 'ifname'));
		const devices = {};
		const rv = [];

		for (let nn of networkNames) {
			var net = network.instantiateNetwork(nn),
			    dev = net ? net.getDevice() : null;

			if (dev)
				devices[dev.getName()] = dev;
		}

		for (let dn of deviceNames) {
			const dev = network.getDevice(dn);

			if (dev)
				devices[dev.getName()] = dev;
		}

		deviceNames = Object.keys(devices);
		deviceNames.sort();

		for (let dn of deviceNames)
			rv.push(devices[dn]);

		this.devices = rv;

		return rv;
	},

	getUptime() {
		const networkNames = L.toArray(uci.get('network', this.sid, 'network'));
		let uptime = 0;

		for (let nn of networkNames) {
			const net = network.instantiateNetwork(nn);
			if (net)
				uptime = Math.max(uptime, net.getUptime());
		}

		return uptime;
	},

	getErrors() {
		return null;
	},

	renderFormOptions(s) {
		var o;

		o = s.taboption('general', form.Value, 'ipaddr', _('Local IPv4 address'), _('Address to access local relay bridge'));
		o.datatype = 'ip4addr("nomask")';

		o = s.taboption('general', widgets.NetworkSelect, 'network', _('Relay between networks'));
		o.exclude = s.section;
		o.multiple = true;
		o.nocreate = true;
		o.nobridges = true;
		o.novirtual = true;

		o = s.taboption('advanced', form.Flag, 'forward_bcast', _('Forward broadcast traffic'));
		o.default = o.enabled;

		o = s.taboption('advanced', form.Flag, 'forward_dhcp', _('Forward DHCP traffic'));
		o.default = o.enabled;

		o = s.taboption('advanced', form.Value, 'gateway', _('Use DHCP gateway'), _('Override the gateway in DHCP responses'));
		o.datatype = 'ip4addr("nomask")';
		o.depends('forward_dhcp', '1');

		o = s.taboption('advanced', form.Value, 'expiry', _('Host expiry timeout'), _('Specifies the maximum amount of seconds after which hosts are presumed to be dead'));
		o.placeholder = '30';
		o.datatype    = 'min(1)';

		o = s.taboption('advanced', form.Value, 'retry', _('ARP retry threshold'), _('Specifies the maximum amount of failed ARP requests until hosts are presumed to be dead'));
		o.placeholder = '5';
		o.datatype    = 'min(1)';

		o = s.taboption('advanced', form.Value, 'table', _('Use routing table'), _('Override the table used for internal routes'));
		o.placeholder = '16800';
		o.datatype    = 'range(0,65535)';
	}
});
