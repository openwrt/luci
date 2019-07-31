'use strict';
'require uci';
'require rpc';
'require validation';

var proto_errors = {
	CONNECT_FAILED:			_('Connection attempt failed'),
	INVALID_ADDRESS:		_('IP address in invalid'),
	INVALID_GATEWAY:		_('Gateway address is invalid'),
	INVALID_LOCAL_ADDRESS:	_('Local IP address is invalid'),
	MISSING_ADDRESS:		_('IP address is missing'),
	MISSING_PEER_ADDRESS:	_('Peer address is missing'),
	NO_DEVICE:				_('Network device is not present'),
	NO_IFACE:				_('Unable to determine device name'),
	NO_IFNAME:				_('Unable to determine device name'),
	NO_WAN_ADDRESS:			_('Unable to determine external IP address'),
	NO_WAN_LINK:			_('Unable to determine upstream interface'),
	PEER_RESOLVE_FAIL:		_('Unable to resolve peer host name'),
	PIN_FAILED:				_('PIN code rejected')
};

var iface_patterns_ignore = [
	/^wmaster\d+/,
	/^wifi\d+/,
	/^hwsim\d+/,
	/^imq\d+/,
	/^ifb\d+/,
	/^mon\.wlan\d+/,
	/^sit\d+/,
	/^gre\d+/,
	/^gretap\d+/,
	/^ip6gre\d+/,
	/^ip6tnl\d+/,
	/^tunl\d+/,
	/^lo$/
];

var iface_patterns_wireless = [
	/^wlan\d+/,
	/^wl\d+/,
	/^ath\d+/,
	/^\w+\.network\d+/
];

var iface_patterns_virtual = [ ];

var callNetworkWirelessStatus = rpc.declare({
	object: 'network.wireless',
	method: 'status'
});

var callLuciNetdevs = rpc.declare({
	object: 'luci',
	method: 'netdevs'
});

var callLuciIfaddrs = rpc.declare({
	object: 'luci',
	method: 'ifaddrs',
	expect: { result: [] }
});

var callLuciBoardjson = rpc.declare({
	object: 'luci',
	method: 'boardjson'
});

var callIwinfoInfo = rpc.declare({
	object: 'iwinfo',
	method: 'info',
	params: [ 'device' ]
});

var callNetworkInterfaceStatus = rpc.declare({
	object: 'network.interface',
	method: 'dump',
	expect: { 'interface': [] }
});

var callNetworkDeviceStatus = rpc.declare({
	object: 'network.device',
	method: 'status',
	expect: { '': {} }
});

var _cache = {},
    _flush = true,
    _state = null,
    _protocols = {};

function getWifiState(flush) {
	if (_cache.wifi == null || flush)
		return callNetworkWirelessStatus().then(function(state) {
			if (!L.isObject(state))
				throw !1;
			return (_cache.wifi = state);
		}).catch(function() {
			return (_cache.wifi = {});
		});

	return Promise.resolve(_cache.wifi);
}

function getInterfaceState(flush) {
	if (_cache.interfacedump == null || flush)
		return callNetworkInterfaceStatus().then(function(state) {
			if (!Array.isArray(state))
				throw !1;
			return (_cache.interfacedump = state);
		}).catch(function() {
			return (_cache.interfacedump = []);
		});

	return Promise.resolve(_cache.interfacedump);
}

function getDeviceState(flush) {
	if (_cache.devicedump == null || flush)
		return callNetworkDeviceStatus().then(function(state) {
			if (!L.isObject(state))
				throw !1;
			return (_cache.devicedump = state);
		}).catch(function() {
			return (_cache.devicedump = {});
		});

	return Promise.resolve(_cache.devicedump);
}

function getIfaddrState(flush) {
	if (_cache.ifaddrs == null || flush)
		return callLuciIfaddrs().then(function(addrs) {
			if (!Array.isArray(addrs))
				throw !1;
			return (_cache.ifaddrs = addrs);
		}).catch(function() {
			return (_cache.ifaddrs = []);
		});

	return Promise.resolve(_cache.ifaddrs);
}

function getNetdevState(flush) {
	if (_cache.devices == null || flush)
		return callLuciNetdevs().then(function(state) {
			if (!L.isObject(state))
				throw !1;
			return (_cache.devices = state);
		}).catch(function() {
			return (_cache.devices = {});
		});

	return Promise.resolve(_cache.devices);
}

function getBoardState(flush) {
	if (_cache.board == null || flush)
		return callLuciBoardjson().then(function(state) {
			if (!L.isObject(state))
				throw !1;
			return (_cache.board = state);
		}).catch(function() {
			return (_cache.board = {});
		});

	return Promise.resolve(_cache.board);
}

function getWifiStateBySid(sid) {
	var s = uci.get('wireless', sid);

	if (s != null && s['.type'] == 'wifi-iface') {
		for (var radioname in _cache.wifi) {
			for (var i = 0; i < _cache.wifi[radioname].interfaces.length; i++) {
				var netstate = _cache.wifi[radioname].interfaces[i];

				if (typeof(netstate.section) != 'string')
					continue;

				var s2 = uci.get('wireless', netstate.section);

				if (s2 != null && s['.type'] == s2['.type'] && s['.name'] == s2['.name'])
					return [ radioname, _cache.wifi[radioname], netstate ];
			}
		}
	}

	return null;
}

function getWifiStateByIfname(ifname) {
	for (var radioname in _cache.wifi) {
		for (var i = 0; i < _cache.wifi[radioname].interfaces.length; i++) {
			var netstate = _cache.wifi[radioname].interfaces[i];

			if (typeof(netstate.ifname) != 'string')
				continue;

			if (netstate.ifname == ifname)
				return [ radioname, _cache.wifi[radioname], netstate ];
		}
	}

	return null;
}

function isWifiIfname(ifname) {
	for (var i = 0; i < iface_patterns_wireless.length; i++)
		if (iface_patterns_wireless[i].test(ifname))
			return true;

	return false;
}

function getWifiIwinfoByIfname(ifname, forcePhyOnly) {
	var tasks = [ callIwinfoInfo(ifname) ];

	if (!forcePhyOnly)
		tasks.push(getNetdevState());

	return Promise.all(tasks).then(function(info) {
		var iwinfo = info[0],
		    devstate = info[1],
		    phyonly = forcePhyOnly || !devstate[ifname] || (devstate[ifname].type != 1);

		if (L.isObject(iwinfo)) {
			if (phyonly) {
				delete iwinfo.bitrate;
				delete iwinfo.quality;
				delete iwinfo.quality_max;
				delete iwinfo.mode;
				delete iwinfo.ssid;
				delete iwinfo.bssid;
				delete iwinfo.encryption;
			}

			iwinfo.ifname = ifname;
		}

		return iwinfo;
	}).catch(function() {
		return null;
	});
}

function getWifiSidByNetid(netid) {
	var m = /^(\w+)\.network(\d+)$/.exec(netid);
	if (m) {
		var sections = uci.sections('wireless', 'wifi-iface');
		for (var i = 0, n = 0; i < sections.length; i++) {
			if (sections[i].device != m[1])
				continue;

			if (++n == +m[2])
				return sections[i]['.name'];
		}
	}

	return null;
}

function getWifiSidByIfname(ifname) {
	var sid = getWifiSidByNetid(ifname);

	if (sid != null)
		return sid;

	var res = getWifiStateByIfname(ifname);

	if (res != null && L.isObject(res[2]) && typeof(res[2].section) == 'string')
		return res[2].section;

	return null;
}

function getWifiNetidBySid(sid) {
	var s = uci.get('wireless', sid);
	if (s != null && s['.type'] == 'wifi-iface') {
		var radioname = s.device;
		if (typeof(s.device) == 'string') {
			var i = 0, netid = null, sections = uci.sections('wireless', 'wifi-iface');
			for (var i = 0, n = 0; i < sections.length; i++) {
				if (sections[i].device != s.device)
					continue;

				n++;

				if (sections[i]['.name'] != s['.name'])
					continue;

				return [ '%s.network%d'.format(s.device, n), s.device ];
			}

		}
	}

	return null;
}

function getWifiNetidByNetname(name) {
	var sections = uci.sections('wireless', 'wifi-iface');
	for (var i = 0; i < sections.length; i++) {
		if (typeof(sections[i].network) != 'string')
			continue;

		var nets = sections[i].network.split(/\s+/);
		for (var j = 0; j < nets.length; j++) {
			if (nets[j] != name)
				continue;

			return getWifiNetidBySid(sections[i]['.name']);
		}
	}

	return null;
}

function isVirtualIfname(ifname) {
	for (var i = 0; i < iface_patterns_virtual.length; i++)
		if (iface_patterns_virtual[i].test(ifname))
			return true;

	return false;
}

function isIgnoredIfname(ifname) {
	for (var i = 0; i < iface_patterns_ignore.length; i++)
		if (iface_patterns_ignore[i].test(ifname))
			return true;

	return false;
}

function appendValue(config, section, option, value) {
	var values = uci.get(config, section, option),
	    isArray = Array.isArray(values),
	    rv = false;

	if (isArray == false)
		values = String(values || '').split(/\s+/);

	if (values.indexOf(value) == -1) {
		values.push(value);
		rv = true;
	}

	uci.set(config, section, option, isArray ? values : values.join(' '));

	return rv;
}

function removeValue(config, section, option, value) {
	var values = uci.get(config, section, option),
	    isArray = Array.isArray(values),
	    rv = false;

	if (isArray == false)
		values = String(values || '').split(/\s+/);

	for (var i = values.length - 1; i >= 0; i--) {
		if (values[i] == value) {
			values.splice(i, 1);
			rv = true;
		}
	}

	if (values.length > 0)
		uci.set(config, section, option, isArray ? values : values.join(' '));
	else
		uci.unset(config, section, option);

	return rv;
}

function prefixToMask(bits, v6) {
	var w = v6 ? 128 : 32,
	    m = [];

	if (bits > w)
		return null;

	for (var i = 0; i < w / 16; i++) {
		var b = Math.min(16, bits);
		m.push((0xffff << (16 - b)) & 0xffff);
		bits -= b;
	}

	if (v6)
		return String.prototype.format.apply('%x:%x:%x:%x:%x:%x:%x:%x', m).replace(/:0(?::0)+$/, '::');
	else
		return '%d.%d.%d.%d'.format(m[0] >>> 8, m[0] & 0xff, m[1] >>> 8, m[1] & 0xff);
}

function maskToPrefix(mask, v6) {
	var m = v6 ? validation.parseIPv6(mask) : validation.parseIPv4(mask);

	if (!m)
		return null;

	var bits = 0;

	for (var i = 0, z = false; i < m.length; i++) {
		z = z || !m[i];

		while (!z && (m[i] & (v6 ? 0x8000 : 0x80))) {
			m[i] = (m[i] << 1) & (v6 ? 0xffff : 0xff);
			bits++;
		}

		if (m[i])
			return null;
	}

	return bits;
}

function initNetworkState() {
	var flush = _flush;

	_flush = false;

	if (_state != null && !flush)
		return Promise.resolve(_state);

	if (_cache.pendingInit != null)
		return Promise.resolve(_cache.pendingInit);

	return (_cache.pendingInit = Promise.all([
		getInterfaceState(flush), getDeviceState(flush), getBoardState(flush),
		getWifiState(flush), getIfaddrState(flush), getNetdevState(flush), getProtocolHandlers(flush),
		uci.load('network'), uci.load('wireless'), uci.load('luci')
	]).finally(function() {
		var ifaddrs = _cache.ifaddrs,
		    devices = _cache.devices,
		    board = _cache.board,
		    s = { isTunnel: {}, isBridge: {}, isSwitch: {}, isWifi: {}, interfaces: {}, bridges: {}, switches: {} };

		for (var i = 0, a; (a = ifaddrs[i]) != null; i++) {
			var name = a.name.replace(/:.+$/, '');

			if (isVirtualIfname(name))
				s.isTunnel[name] = true;

			if (s.isTunnel[name] || !(isIgnoredIfname(name) || isVirtualIfname(name))) {
				s.interfaces[name] = s.interfaces[name] || {
					idx:      a.ifindex || i,
					name:     name,
					rawname:  a.name,
					flags:    [],
					ipaddrs:  [],
					ip6addrs: []
				};

				if (a.family == 'packet') {
					s.interfaces[name].flags   = a.flags;
					s.interfaces[name].stats   = a.data;
					s.interfaces[name].macaddr = a.addr;
				}
				else if (a.family == 'inet') {
					s.interfaces[name].ipaddrs.push(a.addr + '/' + a.netmask);
				}
				else if (a.family == 'inet6') {
					s.interfaces[name].ip6addrs.push(a.addr + '/' + a.netmask);
				}
			}
		}

		for (var devname in devices) {
			var dev = devices[devname];

			if (dev.bridge) {
				var b = {
					name:    devname,
					id:      dev.id,
					stp:     dev.stp,
					ifnames: []
				};

				for (var i = 0; dev.ports && i < dev.ports.length; i++) {
					var subdev = s.interfaces[dev.ports[i]];

					if (subdev == null)
						continue;

					b.ifnames.push(subdev);
					subdev.bridge = b;
				}

				s.bridges[devname] = b;
			}
		}

		if (L.isObject(board.switch)) {
			for (var switchname in board.switch) {
				var layout = board.switch[switchname],
				    netdevs = {},
				    nports = {},
				    ports = [],
				    pnum = null,
				    role = null;

				if (L.isObject(layout) && Array.isArray(layout.ports)) {
					for (var i = 0, port; (port = layout.ports[i]) != null; i++) {
						if (typeof(port) == 'object' && typeof(port.num) == 'number' &&
							(typeof(port.role) == 'string' || typeof(port.device) == 'string')) {
							var spec = {
								num:   port.num,
								role:  port.role || 'cpu',
								index: (port.index != null) ? port.index : port.num
							};

							if (port.device != null) {
								spec.device = port.device;
								spec.tagged = spec.need_tag;
								netdevs[port.num] = port.device;
							}

							ports.push(spec);

							if (port.role != null)
								nports[port.role] = (nports[port.role] || 0) + 1;
						}
					}

					ports.sort(function(a, b) {
						if (a.role != b.role)
							return (a.role < b.role) ? -1 : 1;

						return (a.index - b.index);
					});

					for (var i = 0, port; (port = ports[i]) != null; i++) {
						if (port.role != role) {
							role = port.role;
							pnum = 1;
						}

						if (role == 'cpu')
							port.label = 'CPU (%s)'.format(port.device);
						else if (nports[role] > 1)
							port.label = '%s %d'.format(role.toUpperCase(), pnum++);
						else
							port.label = role.toUpperCase();

						delete port.role;
						delete port.index;
					}

					s.switches[switchname] = {
						ports: ports,
						netdevs: netdevs
					};
				}
			}
		}

		delete _cache.pendingInit;

		return (_state = s);
	}));
}

function ifnameOf(obj) {
	if (obj instanceof Protocol)
		return obj.getIfname();
	else if (obj instanceof Device)
		return obj.getName();
	else if (obj instanceof WifiDevice)
		return obj.getName();
	else if (obj instanceof WifiNetwork)
		return obj.getIfname();
	else if (typeof(obj) == 'string')
		return obj.replace(/:.+$/, '');

	return null;
}

function networkSort(a, b) {
	return a.getName() > b.getName();
}

function deviceSort(a, b) {
	var typeWeigth = { wifi: 2, alias: 3 },
        weightA = typeWeigth[a.getType()] || 1,
        weightB = typeWeigth[b.getType()] || 1;

    if (weightA != weightB)
    	return weightA - weightB;

	return a.getName() > b.getName();
}


var Network, Protocol, Device, WifiDevice, WifiNetwork;

Network = L.Class.extend({
	prefixToMask: prefixToMask,
	maskToPrefix: maskToPrefix,

	flushCache: function() {
		return Promise.resolve(_state).then(function() {
			_flush = true;
		});
	},

	getProtocol: function(protoname, netname) {
		var v = _protocols[protoname];
		if (v != null)
			return v(netname || '__dummy__');

		return null;
	},

	getProtocols: function() {
		var rv = [];

		for (var protoname in _protocols)
			rv.push(_protocols[protoname]('__dummy__'));

		return rv;
	},

	registerProtocol: function(protoname, methods) {
		var proto = Protocol.extend(Object.assign({}, methods, {
			__init__: function(name) {
				this.sid = name;
			},

			proto: function() {
				return protoname;
			}
		}));

		_protocols[protoname] = proto;

		return proto;
	},

	registerPatternVirtual: function(pat) {
		iface_patterns_virtual.push(pat);
	},

	registerErrorCode: function(code, message) {
		if (typeof(code) == 'string' &&
		    typeof(message) == 'string' &&
		    proto_errors.hasOwnProperty(code)) {
			proto_errors[code] = message;
			return true;
		}

		return false;
	},

	addNetwork: function(name, options) {
		return this.getNetwork(name).then(L.bind(function(existingNetwork) {
			if (name != null && /^[a-zA-Z0-9_]+$/.test(name) && existingNetwork == null) {
				var sid = uci.add('network', 'interface', name);

				if (sid != null) {
					if (L.isObject(options))
						for (var key in options)
							if (options.hasOwnProperty(key))
								uci.set('network', sid, key, options[key]);

					return this.instantiateNetwork(sid);
				}
			}
			else if (existingNetwork != null && existingNetwork.isEmpty()) {
				if (L.isObject(options))
					for (var key in options)
						if (options.hasOwnProperty(key))
							existingNetwork.set(key, options[key]);

				return existingNetwork;
			}
		}, this));
	},

	getNetwork: function(name) {
		return initNetworkState().then(L.bind(function() {
			var section = (name != null) ? uci.get('network', name) : null;

			if (section != null && section['.type'] == 'interface') {
				return this.instantiateNetwork(name);
			}
			else if (name != null) {
				for (var i = 0; i < _cache.interfacedump.length; i++)
					if (_cache.interfacedump[i].interface == name)
						return this.instantiateNetwork(name, _cache.interfacedump[i].proto);
			}

			return null;
		}, this));
	},

	getNetworks: function() {
		return initNetworkState().then(L.bind(function() {
			var uciInterfaces = uci.sections('network', 'interface'),
			    networks = {};

			for (var i = 0; i < uciInterfaces.length; i++)
				networks[uciInterfaces[i]['.name']] = this.instantiateNetwork(uciInterfaces[i]['.name']);

			for (var i = 0; i < _cache.interfacedump.length; i++)
				if (networks[_cache.interfacedump[i].interface] == null)
					networks[_cache.interfacedump[i].interface] =
						this.instantiateNetwork(_cache.interfacedump[i].interface, _cache.interfacedump[i].proto);

			var rv = [];

			for (var network in networks)
				if (networks.hasOwnProperty(network))
					rv.push(networks[network]);

			rv.sort(networkSort);

			return rv;
		}, this));
	},

	deleteNetwork: function(name) {
		return Promise.all([ L.require('firewall').catch(function() { return null }), initNetworkState() ]).then(function() {
			var uciInterface = uci.get('network', name);

			if (uciInterface != null && uciInterface['.type'] == 'interface') {
				uci.remove('network', name);

				uci.sections('luci', 'ifstate', function(s) {
					if (s.interface == name)
						uci.remove('luci', s['.name']);
				});

				uci.sections('network', 'alias', function(s) {
					if (s.interface == name)
						uci.remove('network', s['.name']);
				});

				uci.sections('network', 'route', function(s) {
					if (s.interface == name)
						uci.remove('network', s['.name']);
				});

				uci.sections('network', 'route6', function(s) {
					if (s.interface == name)
						uci.remove('network', s['.name']);
				});

				uci.sections('wireless', 'wifi-iface', function(s) {
					var networks = L.toArray(s.network).filter(function(network) { return network != name });

					if (networks.length > 0)
						uci.set('wireless', s['.name'], 'network', networks.join(' '));
					else
						uci.unset('wireless', s['.name'], 'network');
				});

				if (L.firewall)
					return L.firewall.deleteNetwork(name).then(function() { return true });

				return true;
			}

			return false;
		});
	},

	renameNetwork: function(oldName, newName) {
		return initNetworkState().then(function() {
			if (newName == null || !/^[a-zA-Z0-9_]+$/.test(newName) || uci.get('network', newName) != null)
				return false;

			var oldNetwork = uci.get('network', oldName);

			if (oldNetwork == null || oldNetwork['.type'] != 'interface')
				return false;

			var sid = uci.add('network', 'interface', newName);

			for (var key in oldNetwork)
				if (oldNetwork.hasOwnProperty(key) && key.charAt(0) != '.')
					uci.set('network', sid, key, oldNetwork[key]);

			uci.sections('luci', 'ifstate', function(s) {
				if (s.interface == oldName)
					uci.set('luci', s['.name'], 'interface', newName);
			});

			uci.sections('network', 'alias', function(s) {
				if (s.interface == oldName)
					uci.set('network', s['.name'], 'interface', newName);
			});

			uci.sections('network', 'route', function(s) {
				if (s.interface == oldName)
					uci.set('network', s['.name'], 'interface', newName);
			});

			uci.sections('network', 'route6', function(s) {
				if (s.interface == oldName)
					uci.set('network', s['.name'], 'interface', newName);
			});

			uci.sections('wireless', 'wifi-iface', function(s) {
				var networks = L.toArray(s.network).map(function(network) { return (network == oldName ? newName : network) });

				if (networks.length > 0)
					uci.set('wireless', s['.name'], 'network', networks.join(' '));
			});

			uci.remove('network', oldName);

			return true;
		});
	},

	getDevice: function(name) {
		return initNetworkState().then(L.bind(function() {
			if (name == null)
				return null;

			if (_state.interfaces.hasOwnProperty(name) || isWifiIfname(name))
				return this.instantiateDevice(name);

			var netid = getWifiNetidBySid(name);
			if (netid != null)
				return this.instantiateDevice(netid[0]);

			return null;
		}, this));
	},

	getDevices: function() {
		return initNetworkState().then(L.bind(function() {
			var devices = {};

			/* find simple devices */
			var uciInterfaces = uci.sections('network', 'interface');
			for (var i = 0; i < uciInterfaces.length; i++) {
				var ifnames = L.toArray(uciInterfaces[i].ifname);

				for (var j = 0; j < ifnames.length; j++) {
					if (ifnames[j].charAt(0) == '@')
						continue;

					if (isIgnoredIfname(ifnames[j]) || isVirtualIfname(ifnames[j]) || isWifiIfname(ifnames[j]))
						continue;

					devices[ifnames[j]] = this.instantiateDevice(ifnames[j]);
				}
			}

			for (var ifname in _state.interfaces) {
				if (devices.hasOwnProperty(ifname))
					continue;

				if (isIgnoredIfname(ifname) || isVirtualIfname(ifname) || isWifiIfname(ifname))
					continue;

				devices[ifname] = this.instantiateDevice(ifname);
			}

			/* find VLAN devices */
			var uciSwitchVLANs = uci.sections('network', 'switch_vlan');
			for (var i = 0; i < uciSwitchVLANs.length; i++) {
				if (typeof(uciSwitchVLANs[i].ports) != 'string' ||
				    typeof(uciSwitchVLANs[i].device) != 'string' ||
				    !_state.switches.hasOwnProperty(uciSwitchVLANs[i].device))
					continue;

				var ports = uciSwitchVLANs[i].ports.split(/\s+/);
				for (var j = 0; j < ports.length; j++) {
					var m = ports[j].match(/^(\d+)([tu]?)$/);
					if (m == null)
						continue;

					var netdev = _state.switches[uciSwitchVLANs[i].device].netdevs[m[1]];
					if (netdev == null)
						continue;

					if (!devices.hasOwnProperty(netdev))
						devices[netdev] = this.instantiateDevice(netdev);

					_state.isSwitch[netdev] = true;

					if (m[2] != 't')
						continue;

					var vid = uciSwitchVLANs[i].vid || uciSwitchVLANs[i].vlan;
					    vid = (vid != null ? +vid : null);

					if (vid == null || vid < 0 || vid > 4095)
						continue;

					var vlandev = '%s.%d'.format(netdev, vid);

					if (!devices.hasOwnProperty(vlandev))
						devices[vlandev] = this.instantiateDevice(vlandev);

					_state.isSwitch[vlandev] = true;
				}
			}

			/* find wireless interfaces */
			var uciWifiIfaces = uci.sections('wireless', 'wifi-iface'),
			    networkCount = {};

			for (var i = 0; i < uciWifiIfaces.length; i++) {
				if (typeof(uciWifiIfaces[i].device) != 'string')
					continue;

				networkCount[uciWifiIfaces[i].device] = (networkCount[uciWifiIfaces[i].device] || 0) + 1;

				var netid = '%s.network%d'.format(uciWifiIfaces[i].device, networkCount[uciWifiIfaces[i].device]);

				devices[netid] = this.instantiateDevice(netid);
			}

			var rv = [];

			for (var netdev in devices)
				if (devices.hasOwnProperty(netdev))
					rv.push(devices[netdev]);

			rv.sort(deviceSort);

			return rv;
		}, this));
	},

	isIgnoredDevice: function(name) {
		return isIgnoredIfname(name);
	},

	getWifiDevice: function(devname) {
		return Promise.all([ getWifiIwinfoByIfname(devname, true), initNetworkState() ]).then(L.bind(function(res) {
			var existingDevice = uci.get('wireless', devname);

			if (existingDevice == null || existingDevice['.type'] != 'wifi-device')
				return null;

			return this.instantiateWifiDevice(devname, res[0]);
		}, this));
	},

	getWifiDevices: function() {
		var deviceNames = [];

		return initNetworkState().then(L.bind(function() {
			var uciWifiDevices = uci.sections('wireless', 'wifi-device'),
			    tasks = [];

			for (var i = 0; i < uciWifiDevices.length; i++) {
				tasks.push(callIwinfoInfo(uciWifiDevices['.name'], true));
				deviceNames.push(uciWifiDevices['.name']);
			}

			return Promise.all(tasks);
		}, this)).then(L.bind(function(iwinfos) {
			var rv = [];

			for (var i = 0; i < deviceNames.length; i++)
				if (L.isObject(iwinfos[i]))
					rv.push(this.instantiateWifiDevice(deviceNames[i], iwinfos[i]));

			rv.sort(function(a, b) { return a.getName() < b.getName() });

			return rv;
		}, this));
	},

	getWifiNetwork: function(netname) {
		var sid, res, netid, radioname, radiostate, netstate;

		return initNetworkState().then(L.bind(function() {
			sid = getWifiSidByNetid(netname);

			if (sid != null) {
				res        = getWifiStateBySid(sid);
				netid      = netname;
				radioname  = res ? res[0] : null;
				radiostate = res ? res[1] : null;
				netstate   = res ? res[2] : null;
			}
			else {
				res = getWifiStateByIfname(netname);

				if (res != null) {
					radioname  = res[0];
					radiostate = res[1];
					netstate   = res[2];
					sid        = netstate.section;
					netid      = L.toArray(getWifiNetidBySid(sid))[0];
				}
				else {
					res = getWifiStateBySid(netname);

					if (res != null) {
						radioname  = res[0];
						radiostate = res[1];
						netstate   = res[2];
						sid        = netname;
						netid      = L.toArray(getWifiNetidBySid(sid))[0];
					}
					else {
						res = getWifiNetidBySid(netname);

						if (res != null) {
							netid     = res[0];
							radioname = res[1];
							sid       = netname;
						}
					}
				}
			}

			return (netstate ? getWifiIwinfoByIfname(netstate.ifname) : Promise.reject())
				.catch(function() { return radioname ? getWifiIwinfoByIfname(radioname) : Promise.reject() })
				.catch(function() { return Promise.resolve({ ifname: netid || sid || netname }) });
		}, this)).then(L.bind(function(iwinfo) {
			return this.instantiateWifiNetwork(sid || netname, radioname, radiostate, netid, netstate, iwinfo);
		}, this));
	},

	addWifiNetwork: function(options) {
		return initNetworkState().then(L.bind(function() {
			if (options == null ||
			    typeof(options) != 'object' ||
			    typeof(options.device) != 'string')
			    return null;

			var existingDevice = uci.get('wireless', options.device);
			if (existingDevice == null || existingDevice['.type'] != 'wifi-device')
				return null;

			var sid = uci.add('wireless', 'wifi-iface');
			for (var key in options)
				if (options.hasOwnProperty(key))
					uci.set('wireless', sid, key, options[key]);

			var radioname = existingDevice['.name'],
			    netid = getWifiNetidBySid(sid) || [];

			return this.instantiateWifiNetwork(sid, radioname, _cache.wifi[radioname], netid[0], null, { ifname: netid });
		}, this));
	},

	deleteWifiNetwork: function(netname) {
		return initNetworkState().then(L.bind(function() {
			var sid = getWifiSidByIfname(netname);

			if (sid == null)
				return false;

			uci.remove('wireless', sid);
			return true;
		}, this));
	},

	getStatusByRoute: function(addr, mask) {
		return initNetworkState().then(L.bind(function() {
			var rv = [];

			for (var i = 0; i < _state.interfacedump.length; i++) {
				if (!Array.isArray(_state.interfacedump[i].route))
					continue;

				for (var j = 0; j < _state.interfacedump[i].route.length; j++) {
					if (typeof(_state.interfacedump[i].route[j]) != 'object' ||
					    typeof(_state.interfacedump[i].route[j].target) != 'string' ||
					    typeof(_state.interfacedump[i].route[j].mask) != 'number')
					    continue;

					if (_state.interfacedump[i].route[j].table)
						continue;

					rv.push(_state.interfacedump[i]);
				}
			}

			return rv;
		}, this));
	},

	getStatusByAddress: function(addr) {
		return initNetworkState().then(L.bind(function() {
			var rv = [];

			for (var i = 0; i < _state.interfacedump.length; i++) {
				if (Array.isArray(_state.interfacedump[i]['ipv4-address']))
					for (var j = 0; j < _state.interfacedump[i]['ipv4-address'].length; j++)
						if (typeof(_state.interfacedump[i]['ipv4-address'][j]) == 'object' &&
						    _state.interfacedump[i]['ipv4-address'][j].address == addr)
							return _state.interfacedump[i];

				if (Array.isArray(_state.interfacedump[i]['ipv6-address']))
					for (var j = 0; j < _state.interfacedump[i]['ipv6-address'].length; j++)
						if (typeof(_state.interfacedump[i]['ipv6-address'][j]) == 'object' &&
						    _state.interfacedump[i]['ipv6-address'][j].address == addr)
							return _state.interfacedump[i];

				if (Array.isArray(_state.interfacedump[i]['ipv6-prefix-assignment']))
					for (var j = 0; j < _state.interfacedump[i]['ipv6-prefix-assignment'].length; j++)
						if (typeof(_state.interfacedump[i]['ipv6-prefix-assignment'][j]) == 'object' &&
							typeof(_state.interfacedump[i]['ipv6-prefix-assignment'][j]['local-address']) == 'object' &&
						    _state.interfacedump[i]['ipv6-prefix-assignment'][j]['local-address'].address == addr)
							return _state.interfacedump[i];
			}

			return null;
		}, this));
	},

	getWANNetworks: function() {
		return this.getStatusByRoute('0.0.0.0', 0).then(L.bind(function(statuses) {
			var rv = [];

			for (var i = 0; i < statuses.length; i++)
				rv.push(this.instantiateNetwork(statuses[i].interface, statuses[i].proto));

			return rv;
		}, this));
	},

	getWAN6Networks: function() {
		return this.getStatusByRoute('::', 0).then(L.bind(function(statuses) {
			var rv = [];

			for (var i = 0; i < statuses.length; i++)
				rv.push(this.instantiateNetwork(statuses[i].interface, statuses[i].proto));

			return rv;
		}, this));
	},

	getSwitchTopologies: function() {
		return initNetworkState().then(function() {
			return _state.switches;
		});
	},

	instantiateNetwork: function(name, proto) {
		if (name == null)
			return null;

		proto = (proto == null ? uci.get('network', name, 'proto') : proto);

		var protoClass = _protocols[proto] || Protocol;
		return new protoClass(name);
	},

	instantiateDevice: function(name, network) {
		return new Device(name, network);
	},

	instantiateWifiDevice: function(radioname, iwinfo) {
		return new WifiDevice(radioname, iwinfo);
	},

	instantiateWifiNetwork: function(sid, radioname, radiostate, netid, netstate, iwinfo) {
		return new WifiNetwork(sid, radioname, radiostate, netid, netstate, iwinfo);
	},

	getIfnameOf: function(obj) {
		return ifnameOf(obj);
	}
});

Protocol = L.Class.extend({
	__init__: function(name) {
		this.sid = name;
	},

	_get: function(opt) {
		var val = uci.get('network', this.sid, opt);

		if (Array.isArray(val))
			return val.join(' ');

		return val || '';
	},

	_ubus: function(field) {
		for (var i = 0; i < _cache.interfacedump.length; i++) {
			if (_cache.interfacedump[i].interface != this.sid)
				continue;

			return (field != null ? _cache.interfacedump[i][field] : _cache.interfacedump[i]);
		}
	},

	get: function(opt) {
		return uci.get('network', this.sid, opt);
	},

	set: function(opt, val) {
		return uci.set('network', this.sid, opt, val);
	},

	getIfname: function() {
		var ifname;

		if (this.isFloating())
			ifname = this._ubus('l3_device');
		else
			ifname = this._ubus('device');

		if (ifname != null)
			return ifname;

		var res = getWifiNetidByNetname(this.sid);
		return (res != null ? res[0] : null);
	},

	getProtocol: function() {
		return 'none';
	},

	getI18n: function() {
		switch (this.getProtocol()) {
		case 'none':   return _('Unmanaged');
		case 'static': return _('Static address');
		case 'dhcp':   return _('DHCP client');
		default:       return _('Unknown');
		}
	},

	getType: function() {
		return this._get('type');
	},

	getName: function() {
		return this.sid;
	},

	getUptime: function() {
		return this._ubus('uptime') || 0;
	},

	getExpiry: function() {
		var u = this._ubus('uptime'),
		    d = this._ubus('data');

		if (typeof(u) == 'number' && d != null &&
		    typeof(d) == 'object' && typeof(d.leasetime) == 'number') {
			var r = d.leasetime - (u % d.leasetime);
			return (r > 0 ? r : 0);
		}

		return -1;
	},

	getMetric: function() {
		return this._ubus('metric') || 0;
	},

	getZoneName: function() {
		var d = this._ubus('data');

		if (L.isObject(d) && typeof(d.zone) == 'string')
			return d.zone;

		return null;
	},

	getIPAddr: function() {
		var addrs = this._ubus('ipv4-address');
		return ((Array.isArray(addrs) && addrs.length) ? addrs[0].address : null);
	},

	getIPAddrs: function() {
		var addrs = this._ubus('ipv4-address'),
		    rv = [];

		if (Array.isArray(addrs))
			for (var i = 0; i < addrs.length; i++)
				rv.push('%s/%d'.format(addrs[i].address, addrs[i].mask));

		return rv;
	},

	getNetmask: function() {
		var addrs = this._ubus('ipv4-address');
		if (Array.isArray(addrs) && addrs.length)
			return prefixToMask(addrs[0].mask, false);
	},

	getGatewayAddr: function() {
		var routes = this._ubus('route');

		if (Array.isArray(routes))
			for (var i = 0; i < routes.length; i++)
				if (typeof(routes[i]) == 'object' &&
				    routes[i].target == '0.0.0.0' &&
				    routes[i].mask == 0)
				    return routes[i].nexthop;

		return null;
	},

	getDNSAddrs: function() {
		var addrs = this._ubus('dns-server'),
		    rv = [];

		if (Array.isArray(addrs))
			for (var i = 0; i < addrs.length; i++)
				if (!/:/.test(addrs[i]))
					rv.push(addrs[i]);

		return rv;
	},

	getIP6Addr: function() {
		var addrs = this._ubus('ipv6-address');

		if (Array.isArray(addrs) && L.isObject(addrs[0]))
			return '%s/%d'.format(addrs[0].address, addrs[0].mask);

		addrs = this._ubus('ipv6-prefix-assignment');

		if (Array.isArray(addrs) && L.isObject(addrs[0]) && L.isObject(addrs[0]['local-address']))
			return '%s/%d'.format(addrs[0]['local-address'].address, addrs[0]['local-address'].mask);

		return null;
	},

	getIP6Addrs: function() {
		var addrs = this._ubus('ipv6-address'),
		    rv = [];

		if (Array.isArray(addrs))
			for (var i = 0; i < addrs.length; i++)
				if (L.isObject(addrs[i]))
					rv.push('%s/%d'.format(addrs[i].address, addrs[i].mask));

		addrs = this._ubus('ipv6-prefix-assignment');

		if (Array.isArray(addrs))
			for (var i = 0; i < addrs.length; i++)
				if (L.isObject(addrs[i]) && L.isObject(addrs[i]['local-address']))
					rv.push('%s/%d'.format(addrs[i]['local-address'].address, addrs[i]['local-address'].mask));

		return rv;
	},

	getDNS6Addrs: function() {
		var addrs = this._ubus('dns-server'),
		    rv = [];

		if (Array.isArray(addrs))
			for (var i = 0; i < addrs.length; i++)
				if (/:/.test(addrs[i]))
					rv.push(addrs[i]);

		return rv;
	},

	getIP6Prefix: function() {
		var prefixes = this._ubus('ipv6-prefix');

		if (Array.isArray(prefixes) && L.isObject(prefixes[0]))
			return '%s/%d'.format(prefixes[0].address, prefixes[0].mask);

		return null;
	},

	getErrors: function() {
		var errors = this._ubus('errors'),
		    rv = null;

		if (Array.isArray(errors)) {
			for (var i = 0; i < errors.length; i++) {
				if (!L.isObject(errors[i]) || typeof(errors[i].code) != 'string')
					continue;

				rv = rv || [];
				rv.push(proto_errors[errors[i].code] || _('Unknown error (%s)').format(errors[i].code));
			}
		}

		return rv;
	},

	isBridge: function() {
		return (!this.isVirtual() && this.getType() == 'bridge');
	},

	getOpkgPackage: function() {
		return null;
	},

	isInstalled: function() {
		return true;
	},

	isVirtual: function() {
		return false;
	},

	isFloating: function() {
		return false;
	},

	isDynamic: function() {
		return (this._ubus('dynamic') == true);
	},

	isAlias: function() {
		var ifnames = L.toArray(uci.get('network', this.sid, 'ifname')),
		    parent = null;

		for (var i = 0; i < ifnames.length; i++)
			if (ifnames[i].charAt(0) == '@')
				parent = ifnames[i].substr(1);
			else if (parent != null)
				parent = null;

		return parent;
	},

	isEmpty: function() {
		if (this.isFloating())
			return false;

		var empty = true,
		    ifname = this._get('ifname');

		if (ifname != null && ifname.match(/\S+/))
			empty = false;

		if (empty == true && getWifiNetidBySid(this.sid) != null)
			empty = false;

		return empty;
	},

	isUp: function() {
		return (this._ubus('up') == true);
	},

	addDevice: function(ifname) {
		ifname = ifnameOf(ifname);

		if (ifname == null || this.isFloating())
			return false;

		var wif = getWifiSidByIfname(ifname);

		if (wif != null)
			return appendValue('wireless', wif, 'network', this.sid);

		return appendValue('network', this.sid, 'ifname', ifname);
	},

	deleteDevice: function(ifname) {
		var rv = false;

		ifname = ifnameOf(ifname);

		if (ifname == null || this.isFloating())
			return false;

		var wif = getWifiSidByIfname(ifname);

		if (wif != null)
			rv = removeValue('wireless', wif, 'network', this.sid);

		if (removeValue('network', this.sid, 'ifname', ifname))
			rv = true;

		return rv;
	},

	getDevice: function() {
		if (this.isVirtual()) {
			var ifname = '%s-%s'.format(this.getProtocol(), this.sid);
			_state.isTunnel[this.getProtocol() + '-' + this.sid] = true;
			return L.network.instantiateDevice(ifname, this);
		}
		else if (this.isBridge()) {
			var ifname = 'br-%s'.format(this.sid);
			_state.isBridge[ifname] = true;
			return new Device(ifname, this);
		}
		else {
			var ifname = this._ubus('l3_device') || this._ubus('device');

			if (ifname != null)
				return L.network.instantiateDevice(ifname, this);

			var ifnames = L.toArray(uci.get('network', this.sid, 'ifname'));

			for (var i = 0; i < ifnames.length; i++) {
				var m = ifnames[i].match(/^([^:/]+)/);
				return ((m && m[1]) ? L.network.instantiateDevice(m[1], this) : null);
			}

			ifname = getWifiNetidByNetname(this.sid);

			return (ifname != null ? L.network.instantiateDevice(ifname[0], this) : null);
		}
	},

	getDevices: function() {
		var rv = [];

		if (!this.isBridge() && !(this.isVirtual() && !this.isFloating()))
			return null;

		var ifnames = L.toArray(uci.get('network', this.sid, 'ifname'));

		for (var i = 0; i < ifnames.length; i++) {
			if (ifnames[i].charAt(0) == '@')
				continue;

			var m = ifnames[i].match(/^([^:/]+)/);
			if (m != null)
				rv.push(L.network.instantiateDevice(m[1], this));
		}

		var uciWifiIfaces = uci.sections('wireless', 'wifi-iface');

		for (var i = 0; i < uciWifiIfaces.length; i++) {
			if (typeof(uciWifiIfaces[i].device) != 'string')
				continue;

			var networks = L.toArray(uciWifiIfaces[i].network);

			for (var j = 0; j < networks.length; j++) {
				if (networks[j] != this.sid)
					continue;

				var netid = getWifiNetidBySid(uciWifiIfaces[i]['.name']);

				if (netid != null)
					rv.push(L.network.instantiateDevice(netid[0], this));
			}
		}

		rv.sort(deviceSort);

		return rv;
	},

	containsDevice: function(ifname) {
		ifname = ifnameOf(ifname);

		if (ifname == null)
			return false;
		else if (this.isVirtual() && '%s-%s'.format(this.getProtocol(), this.sid) == ifname)
			return true;
		else if (this.isBridge() && 'br-%s'.format(this.sid) == ifname)
			return true;

		var ifnames = L.toArray(uci.get('network', this.sid, 'ifname'));

		for (var i = 0; i < ifnames.length; i++) {
			var m = ifnames[i].match(/^([^:/]+)/);
			if (m != null && m[1] == ifname)
				return true;
		}

		var wif = getWifiSidByIfname(ifname);

		if (wif != null) {
			var networks = L.toArray(uci.get('wireless', wif, 'network'));

			for (var i = 0; i < networks.length; i++)
				if (networks[i] == this.sid)
					return true;
		}

		return false;
	}
});

Device = L.Class.extend({
	__init__: function(ifname, network) {
		var wif = getWifiSidByIfname(ifname);

		if (wif != null) {
			var res = getWifiStateBySid(wif) || [],
			    netid = getWifiNetidBySid(wif) || [];

			this.wif    = new WifiNetwork(wif, res[0], res[1], netid[0], res[2], { ifname: ifname });
			this.ifname = this.wif.getIfname();
		}

		this.ifname  = this.ifname || ifname;
		this.dev     = _state.interfaces[this.ifname];
		this.network = network;
	},

	_ubus: function(field) {
		var dump = _cache.devicedump[this.ifname] || {};

		return (field != null ? dump[field] : dump);
	},

	getName: function() {
		return (this.wif != null ? this.wif.getIfname() : this.ifname);
	},

	getMAC: function() {
		var mac = this._ubus('macaddr');
		return mac ? mac.toUpperCase() : null;
	},

	getIPAddrs: function() {
		var addrs = (this.dev != null ? this.dev.ipaddrs : null);
		return (Array.isArray(addrs) ? addrs : []);
	},

	getIP6Addrs: function() {
		var addrs = (this.dev != null ? this.dev.ip6addrs : null);
		return (Array.isArray(addrs) ? addrs : []);
	},

	getType: function() {
		if (this.ifname != null && this.ifname.charAt(0) == '@')
			return 'alias';
		else if (this.wif != null || isWifiIfname(this.ifname))
			return 'wifi';
		else if (_state.isBridge[this.ifname])
			return 'bridge';
		else if (_state.isTunnel[this.ifname])
			return 'tunnel';
		else if (this.ifname.indexOf('.') > -1)
			return 'vlan';
		else if (_state.isSwitch[this.ifname])
			return 'switch';
		else
			return 'ethernet';
	},

	getShortName: function() {
		if (this.wif != null)
			return this.wif.getShortName();

		return this.ifname;
	},

	getI18n: function() {
		if (this.wif != null) {
			return '%s: %s "%s"'.format(
				_('Wireless Network'),
				this.wif.getActiveMode(),
				this.wif.getActiveSSID() || this.wif.getActiveBSSID() || this.wif.getID() || '?');
		}

		return '%s: "%s"'.format(this.getTypeI18n(), this.getName());
	},

	getTypeI18n: function() {
		switch (this.getType()) {
		case 'alias':
			return _('Alias Interface');

		case 'wifi':
			return _('Wireless Adapter');

		case 'bridge':
			return _('Bridge');

		case 'switch':
			return _('Ethernet Switch');

		case 'vlan':
			return (_state.isSwitch[this.ifname] ? _('Switch VLAN') : _('Software VLAN'));

		case 'tunnel':
			return _('Tunnel Interface');

		default:
			return _('Ethernet Adapter');
		}
	},

	getPorts: function() {
		var br = _state.bridges[this.ifname],
		    rv = [];

		if (br == null || !Array.isArray(br.ifnames))
			return null;

		for (var i = 0; i < br.ifnames.length; i++)
			rv.push(L.network.instantiateDevice(br.ifnames[i]));

		return rv;
	},

	getBridgeID: function() {
		var br = _state.bridges[this.ifname];
		return (br != null ? br.id : null);
	},

	getBridgeSTP: function() {
		var br = _state.bridges[this.ifname];
		return (br != null ? !!br.stp : false);
	},

	isUp: function() {
		var up = this._ubus('up');

		if (up == null)
			up = (this.getType() == 'alias');

		return up;
	},

	isBridge: function() {
		return (this.getType() == 'bridge');
	},

	isBridgePort: function() {
		return (this.dev != null && this.dev.bridge != null);
	},

	getTXBytes: function() {
		var stat = this._ubus('statistics');
		return (stat != null ? stat.tx_bytes || 0 : 0);
	},

	getRXBytes: function() {
		var stat = this._ubus('statistics');
		return (stat != null ? stat.rx_bytes || 0 : 0);
	},

	getTXPackets: function() {
		var stat = this._ubus('statistics');
		return (stat != null ? stat.tx_packets || 0 : 0);
	},

	getRXPackets: function() {
		var stat = this._ubus('statistics');
		return (stat != null ? stat.rx_packets || 0 : 0);
	},

	getNetwork: function() {
		return this.getNetworks()[0];
	},

	getNetworks: function() {
		if (this.networks == null) {
			this.networks = [];

			var networks = L.network.getNetworks();

			for (var i = 0; i < networks.length; i++)
				if (networks[i].containsDevice(this.ifname) || networks[i].getIfname() == this.ifname)
					this.networks.push(networks[i]);

			this.networks.sort(networkSort);
		}

		return this.networks;
	},

	getWifiNetwork: function() {
		return (this.wif != null ? this.wif : null);
	}
});

WifiDevice = L.Class.extend({
	__init__: function(name, iwinfo) {
		var uciWifiDevice = uci.get('wireless', name);

		if (uciWifiDevice != null &&
		    uciWifiDevice['.type'] == 'wifi-device' &&
		    uciWifiDevice['.name'] != null) {
			this.sid    = uciWifiDevice['.name'];
			this.iwinfo = iwinfo;
		}

		this.sid    = this.sid    || name;
		this.iwinfo = this.iwinfo || { ifname: this.sid };
	},

	get: function(opt) {
		return uci.get('wireless', this.sid, opt);
	},

	set: function(opt, value) {
		return uci.set('wireless', this.sid, opt, value);
	},

	getName: function() {
		return this.sid;
	},

	getHWModes: function() {
		if (L.isObject(this.iwinfo.hwmodelist))
			for (var k in this.iwinfo.hwmodelist)
				return this.iwinfo.hwmodelist;

		return { b: true, g: true };
	},

	getI18n: function() {
		var type = this.iwinfo.hardware_name || 'Generic';

		if (this.iwinfo.type == 'wl')
			type = 'Broadcom';

		var hwmodes = this.getHWModes(),
		    modestr = '';

		if (hwmodes.a) modestr += 'a';
		if (hwmodes.b) modestr += 'b';
		if (hwmodes.g) modestr += 'g';
		if (hwmodes.n) modestr += 'n';
		if (hwmodes.ad) modestr += 'ac';

		return '%s 802.11%s Wireless Controller (%s)'.format(type, modestr, this.getName());
	},

	isUp: function() {
		if (L.isObject(_cache.wifi[this.sid]))
			return (_cache.wifi[this.sid].up == true);

		return false;
	},

	getWifiNetwork: function(network) {
		return L.network.getWifiNetwork(network).then(L.bind(function(networkInstance) {
			var uciWifiIface = (networkInstance.sid ? uci.get('wireless', networkInstance.sid) : null);

			if (uciWifiIface == null || uciWifiIface['.type'] != 'wifi-iface' || uciWifiIface.device != this.sid)
				return Promise.reject();

			return networkInstance;
		}, this));
	},

	getWifiNetworks: function() {
		var uciWifiIfaces = uci.sections('wireless', 'wifi-iface'),
		    tasks = [];

		for (var i = 0; i < uciWifiIfaces.length; i++)
			if (uciWifiIfaces[i].device == this.sid)
				tasks.push(L.network.getWifiNetwork(uciWifiIfaces[i]['.name']));

		return Promise.all(tasks);
	},

	addWifiNetwork: function(options) {
		if (!L.isObject(options))
			options = {};

		options.device = this.sid;

		return L.network.addWifiNetwork(options);
	},

	deleteWifiNetwork: function(network) {
		var sid = null;

		if (network instanceof WifiNetwork) {
			sid = network.sid;
		}
		else {
			var uciWifiIface = uci.get('wireless', network);

			if (uciWifiIface == null || uciWifiIface['.type'] != 'wifi-iface')
				sid = getWifiSidByIfname(network);
		}

		if (sid == null || uci.get('wireless', sid, 'device') != this.sid)
			return Promise.resolve(false);

		uci.delete('wireless', network);

		return Promise.resolve(true);
	}
});

WifiNetwork = L.Class.extend({
	__init__: function(sid, radioname, radiostate, netid, netstate, iwinfo) {
		this.sid    = sid;
		this.wdev   = iwinfo.ifname;
		this.iwinfo = iwinfo;
		this.netid  = netid;
		this._ubusdata = {
			radio: radioname,
			dev:   radiostate,
			net:   netstate
		};
	},

	ubus: function(/* ... */) {
		var v = this._ubusdata;

		for (var i = 0; i < arguments.length; i++)
			if (L.isObject(v))
				v = v[arguments[i]];
			else
				return null;

		return v;
	},

	get: function(opt) {
		return uci.get('wireless', this.sid, opt);
	},

	set: function(opt, value) {
		return uci.set('wireless', this.sid, opt, value);
	},

	getMode: function() {
		return this.ubus('net', 'config', 'mode') || this.get('mode') || 'ap';
	},

	getSSID: function() {
		return this.ubus('net', 'config', 'ssid') || this.get('ssid');
	},

	getBSSID: function() {
		return this.ubus('net', 'config', 'bssid') || this.get('bssid');
	},

	getNetworkNames: function() {
		return L.toArray(this.ubus('net', 'config', 'network') || this.get('network'));
	},

	getID: function() {
		return this.netid;
	},

	getName: function() {
		return this.sid;
	},

	getIfname: function() {
		var ifname = this.ubus('net', 'ifname') || this.iwinfo.ifname;

		if (ifname == null || ifname.match(/^(wifi|radio)\d/))
			ifname = this.netid;

		return ifname;
	},

	getWifiDevice: function() {
		var radioname = this.ubus('radio') || this.get('device');

		if (radioname == null)
			return Promise.reject();

		return L.network.getWifiDevice(radioname);
	},

	isUp: function() {
		var device = this.getDevice();

		if (device == null)
			return false;

		return device.isUp();
	},

	getActiveMode: function() {
		var mode = this.iwinfo.mode || this.ubus('net', 'config', 'mode') || this.get('mode') || 'ap';

		switch (mode) {
		case 'ap':      return 'Master';
		case 'sta':     return 'Client';
		case 'adhoc':   return 'Ad-Hoc';
		case 'mesh':    return 'Mesh';
		case 'monitor': return 'Monitor';
		default:        return mode;
		}
	},

	getActiveModeI18n: function() {
		var mode = this.getActiveMode();

		switch (mode) {
		case 'Master':  return _('Master');
		case 'Client':  return _('Client');
		case 'Ad-Hoc':  return _('Ad-Hoc');
		case 'Mash':    return _('Mesh');
		case 'Monitor': return _('Monitor');
		default:        return mode;
		}
	},

	getActiveSSID: function() {
		return this.iwinfo.ssid || this.ubus('net', 'config', 'ssid') || this.get('ssid');
	},

	getActiveBSSID: function() {
		return this.iwinfo.bssid || this.ubus('net', 'config', 'bssid') || this.get('bssid');
	},

	getActiveEncryption: function() {
		var encryption = this.iwinfo.encryption;

		return (L.isObject(encryption) ? encryption.description || '-' : '-');
	},

	getAssocList: function() {
		// XXX tbd
	},

	getFrequency: function() {
		var freq = this.iwinfo.frequency;

		if (freq != null && freq > 0)
			return '%.03f'.format(freq / 1000);

		return null;
	},

	getBitRate: function() {
		var rate = this.iwinfo.bitrate;

		if (rate != null && rate > 0)
			return (rate / 1000);

		return null;
	},

	getChannel: function() {
		return this.iwinfo.channel || this.ubus('dev', 'config', 'channel') || this.get('channel');
	},

	getSignal: function() {
		return this.iwinfo.signal || 0;
	},

	getNoise: function() {
		return this.iwinfo.noise || 0;
	},

	getCountryCode: function() {
		return this.iwinfo.country || this.ubus('dev', 'config', 'country') || '00';
	},

	getTXPower: function() {
		var pwr = this.iwinfo.txpower || 0;
		return (pwr + this.getTXPowerOffset());
	},

	getTXPowerOffset: function() {
		return this.iwinfo.txpower_offset || 0;
	},

	getSignalLevel: function(signal, noise) {
		if (this.getActiveBSSID() == '00:00:00:00:00:00')
			return -1;

		signal = signal || this.getSignal();
		noise  = noise  || this.getNoise();

		if (signal < 0 && noise < 0) {
			var snr = -1 * (noise - signal);
			return Math.floor(snr / 5);
		}

		return 0;
	},

	getSignalPercent: function() {
		var qc = this.iwinfo.quality || 0,
		    qm = this.iwinfo.quality_max || 0;

		if (qc > 0 && qm > 0)
			return Math.floor((100 / qm) * qc);

		return 0;
	},

	getShortName: function() {
		return '%s "%s"'.format(
			this.getActiveModeI18n(),
			this.getActiveSSID() || this.getActiveBSSID() || this.getID());
	},

	getI18n: function() {
		return '%s: %s "%s" (%s)'.format(
			_('Wireless Network'),
			this.getActiveModeI18n(),
			this.getActiveSSID() || this.getActiveBSSID() || this.getID(),
			this.getIfname());
	},

	getNetwork: function() {
		return this.getNetworks()[0];
	},

	getNetworks: function() {
		var networkNames = this.getNetworkNames(),
		    networks = [];

		for (var i = 0; i < networkNames.length; i++) {
			var uciInterface = uci.get('network', networkNames[i]);

			if (uciInterface == null || uciInterface['.type'] != 'interface')
				continue;

			networks.push(L.network.instantiateNetwork(networkNames[i]));
		}

		networks.sort(networkSort);

		return networks;
	},

	getDevice: function() {
		return L.network.instantiateDevice(this.getIfname());
	}
});

return Network;
