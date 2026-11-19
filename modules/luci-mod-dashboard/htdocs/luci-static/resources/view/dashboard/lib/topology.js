'use strict';
'require baseclass';
'require network';
'require rpc';
'require validation';
'require view.dashboard.lib.system as system';

const callAttachments = rpc.declare({
	object: 'luci.dashboard', method: 'topology', reject: true,
	filter: reply => Array.isArray(reply?.bridges) && Array.isArray(reply?.neighbours) ? reply : null
});
const MAC_RE = /^(?:[0-9A-F]{2}:){5}[0-9A-F]{2}$/;

function text(value) {
	return typeof(value) === 'string' ? value.trim() : '';
}

function macAddress(value) {
	const mac = text(value).toUpperCase();
	return MAC_RE.test(mac) && mac !== '00:00:00:00:00:00' && !(parseInt(mac, 16) & 1) ? mac : null;
}

// Compare IPv4/IPv6 addresses independently of compression, case and prefix
// length. This is only an identity key; preserve the supplied spelling for display.
function addressKey(value) {
	const scoped = text(value).replace(/\/\d+$/, '').toLowerCase().split('%');
	if (!scoped[0] || scoped.length > 2)
		return null;
	const v4 = !scoped[1] && validation.parseIPv4(scoped[0]);
	if (v4)
		return v4.join('.');
	const v6 = validation.parseIPv6(scoped[0]);
	return v6 ? v6.map(word => word.toString(16)).join(':') + (scoped[1] ? '%' + scoped[1] : '') : null;
}

function addresses(values) {
	return Array.isArray(values) ? values.map(text).filter(value => addressKey(value)) : [];
}

function byId(a, b) {
	return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function names(values) {
	return Array.isArray(values) ? Array.from(new Set(values.map(text).filter(Boolean))) : [];
}

function modeLabel(mode) {
	if (mode === 'ap' || mode === 'ap-wds')
		return _('Access point');
	if (mode === 'sta' || mode === 'sta-wds')
		return _('Wireless uplink');
	if (mode === 'mesh')
		return _('Mesh peers');
	return _('Wireless peers');
}

return baseclass.extend({
	isMac(value) {
		return MAC_RE.test(text(value));
	},

	loadConnections() {
		// Share network.js and system.js snapshots with the other widgets.
		return Promise.all([
			L.resolveDefault(network.getNetworks(), null),
			L.resolveDefault(network.getHostHints(), null),
			L.resolveDefault(network.getDevices(), []),
			L.resolveDefault(callAttachments(), null),
			L.resolveDefault(network.getWANNetworks(), []),
			L.resolveDefault(network.getWAN6Networks(), []),
			system.board()
		]).then(data => this.collectConnections(data));
	},

	collectConnections([ interfaces, hints, devices, observations, wan, wan6, board ]) {
		const localMACs = new Set(devices.map(dev => dev.getMAC()?.toUpperCase()).filter(Boolean));
		const deviceData = dev => ({
			id: dev.getName?.(),
			type: dev.getType?.(),
			mac: dev.getMAC?.()?.toUpperCase(),
			// getCarrier() turns a missing link record into false. Keep it unknown.
			carrier: typeof(dev.dev?.link?.carrier) === 'boolean' ? dev.dev.link.carrier : null,
			speed: dev.getSpeed?.() ?? null
		});
		const upstreams = [];
		for (const [ family, list ] of [ [ 4, wan ], [ 6, wan6 ] ]) {
			for (const net of list || []) {
				const name = net.getName();
				if (upstreams.some(item => item.family === family && item.network === name))
					continue;
				const gateway = family === 4 ? net.getGatewayAddr() : net.getGateway6Addr();
				upstreams.push({
					family,
					network: name,
					device: net.getL3Device()?.getName() || null,
					gateway: gateway && gateway !== '0.0.0.0' && gateway !== '::' ? gateway : null,
					up: net.isUp()
				});
			}
		}

		return {
			router: {
				hostname: board?.hostname || null,
				model: board?.model || null,
				// This is the endpoint being managed, not an inferred LAN interface.
				managementAddress: typeof(window) === 'object' ? (window.location?.hostname?.replace(/^\[|\]$/g, '') || null) : null,
				upstreams
			},
			observations: observations || null,
			devices: devices.map(deviceData).filter(dev => dev.id),
			interfaces: interfaces?.filter(net => net.getName() !== 'loopback' && net.getL3Device()?.getName() !== 'lo').map(net => {
				const dev = net.getL3Device() || net.getDevice();
				return {
					id: net.getName(),
					name: net.getName(),
					device: dev?.getName() || '',
					protocol: net.getProtocol(),
					type: dev?.getType() || '',
					up: net.isUp(),
					ports: (dev?.getPorts() || []).map(deviceData)
				};
			}) || null,
			hosts: hints ? Object.entries(hints.hosts || {}).filter(([ mac ]) => !localMACs.has(mac.toUpperCase())).map(([ mac, hint ]) => ({
				mac: mac.toUpperCase(),
				name: hint.name || mac,
				addresses: L.toArray(hint.ipaddrs || hint.ipv4).concat(L.toArray(hint.ip6addrs || hint.ipv6))
			})) : null
		};
	},

	buildModel(snapshot) {
		const source = snapshot || {};
		const connections = source.connections || {};
		const router = source.router || connections.router || {};
		const wifi = source.wifi || {};
		const groups = new Map();
		const radios = new Map();
		const upstreams = new Map();
		const memberIds = new Set();
		const interfaces = Array.isArray(connections.interfaces) ? connections.interfaces : [];
		const observations = connections.observations || {};
		const devices = new Map((connections.devices || []).map(device => [ device.id, device ]));
		const localMACs = new Set((connections.devices || []).map(device => macAddress(device.mac)).filter(Boolean));
		const accessFor = (group, id, data) => {
			group.accessById ||= new Map();
			let access = group.accessById.get(id);
			if (!access) {
				access = Object.assign({ id, members: [] }, data);
				group.accessById.set(id, access);
			}
			return access;
		};
		const addMember = (group, member) => {
			(group.macs ||= new Set()).add(member.mac);
			group.members.push(member);
		};

		for (const item of interfaces) {
			const name = text(item?.id);
			if (!name || name === 'loopback' || item.device === 'lo')
				continue;
			groups.set('net:' + name, {
				id: 'net:' + name, name: text(item.name) || name, icon: 'devices',
				kind: 'logical', relation: 'logical', network: name,
				context: text(item.device) || text(item.protocol), active: item.up === true,
				device: item.device, type: item.type, protocol: item.protocol,
				members: [], wifiNetworks: [], errors: [], radios: 0
			});
		}

		// These are reported default-route links, not Internet reachability or
		// policy-routing decisions. Families share a reported device or interface identity.
		for (const item of Array.isArray(router.upstreams) ? router.upstreams : []) {
			if (!item || (item.family !== 4 && item.family !== 6))
				continue;
			const network = text(item.network), device = text(item.device);
			const gateway = addressKey(item.gateway);
			if (!network && !device)
				continue;
			const id = device ? 'device:' + device : 'network:' + network;
			if (!upstreams.has(id))
				upstreams.set(id, { id, device, names: [], families: [], states: [], gateways: [], gatewayAddresses: [], network, tab: 'internet', icon: 'internet' });
			const up = upstreams.get(id);
			if (network && !up.names.includes(network))
				up.names.push(network);
			if (!up.families.includes(item.family))
				up.families.push(item.family);
			up.states.push(item.up === true);
			if (gateway && ![ '0.0.0.0', '0:0:0:0:0:0:0:0' ].includes(gateway) && !up.gateways.includes(gateway)) {
				up.gateways.push(gateway);
				up.gatewayAddresses.push(text(item.gateway));
			}
		}
		const upstreamList = Array.from(upstreams.values());
		for (const up of upstreamList) {
			up.name = up.names.join(' / ') || up.id.slice(7);
			const allUp = up.states.every(Boolean), anyUp = up.states.some(Boolean);
			const state = allUp ? _('Link up') : anyUp ? _('Mixed link state') : _('Link down');
			up.detail = up.families.sort().map(family => 'IPv' + family).join(' / ') + ' · ' + state;
			up.active = anyUp;
			up.status = allUp ? 'up' : anyUp ? 'warn' : 'down';
		}

		const wirelessGroup = radio => {
			const id = 'wifi:' + radio.id;
			if (!groups.has(id))
				groups.set(id, {
					id, name: radio.name, icon: 'wireless', kind: radio.ap ? 'wireless' : 'peer',
					relation: 'logical', tab: 'wifi', network: radio.id,
					context: [ modeLabel(radio.mode), radio.band ].filter(Boolean).join(' · '),
					active: radio.active, members: [], wifiNetworks: [], errors: [], radios: 0
				});
			return groups.get(id);
		};
		const groupFor = (radio, bindings) => {
			if (!radio.ap || bindings.length !== 1)
				return wirelessGroup(radio);
			const id = 'net:' + bindings[0];
			if (!groups.has(id))
				groups.set(id, {
					id, name: bindings[0], icon: 'devices', kind: 'logical', relation: 'logical',
					tab: 'wifi', network: radio.id, context: _('Reported wireless binding'),
					active: radio.active, members: [], wifiNetworks: [], errors: [], radios: 0
				});
			return groups.get(id);
		};
		const linkRadio = (group, radio) => {
			if (group.accessById?.has('wifi:' + radio.id))
				return;
			accessFor(group, 'wifi:' + radio.id, {
				name: radio.name, network: radio.id, icon: 'wireless', kind: 'wireless', active: radio.active, known: radio.known,
				meta: [ !radio.ap ? modeLabel(radio.mode) : null, radio.band ].filter(Boolean).join(' · ') || null,
				detail: [ modeLabel(radio.mode), radio.band, radio.known ? null : _('Data unavailable') ].filter(Boolean).join(' · ')
			});
			group.wifiNetworks.push(radio.id);
			group.radios++;
			if (!radio.known)
				group.errors.push(radio.id);
		};

		for (const item of Array.isArray(wifi.networks) ? wifi.networks : []) {
			const id = text(item?.id), mode = text(item?.mode) || 'ap';
			if (!id || radios.has(id) || mode === 'monitor')
				continue;
			const radio = {
				id, name: text(item.name) || id, device: text(item.device), mode, ap: mode === 'ap' || mode === 'ap-wds',
				band: text(item.band), active: item.active === true, known: item.clientsKnown !== false,
				bindings: names(item.interfaces)
			};
			radios.set(id, radio);
			linkRadio(groupFor(radio, radio.bindings), radio);
		}

		for (const item of Array.isArray(wifi.clients) ? wifi.clients : []) {
			const radio = radios.get(text(item?.network)), mac = macAddress(item?.mac);
			if (!radio || !mac)
				continue;
			const bindings = Array.isArray(item.interfaces) ? names(item.interfaces) : radio.bindings;
			const group = groupFor(radio, bindings);
			linkRadio(group, radio);
			const id = group.id + '|' + radio.id + '|' + mac;
			if (memberIds.has(id))
				continue;
			memberIds.add(id);
			const ips = addresses(item.addresses), name = text(item.name);
			const associated = radio.mode === 'mesh' ? item.associated === true : item.associated !== false;
			const displayTitle = name && name !== '?' ? name : mac;
			const primaryIp = ips[0]?.replace(/\/\d+$/, '');
			addMember(group, {
				id, name: displayTitle, icon: radio.ap ? 'devices' : 'router',
				tab: 'wifi', network: radio.id, mac, relation: associated ? 'observed' : 'unknown',
				access: 'wifi:' + radio.id, addresses: ips,
				detail: associated ? (primaryIp || (displayTitle.toUpperCase() !== mac ? mac : '')) : _('Peer state unknown'),
				context: [ radio.name, radio.band, modeLabel(radio.mode), associated ? '' : _('Peer state unknown') ].filter(Boolean).join(' · ')
			});
		}

		// Netifd supplies membership and carrier information independently of Wi-Fi.
		const wirelessDevices = new Set(Array.from(radios.values(), radio => radio.device).filter(Boolean));
		for (const item of interfaces) {
			const group = groups.get('net:' + item.id);
			if (!group)
				continue;
			for (const port of item.ports || [])
				devices.set(port.id, port);
			const reported = (observations.bridges || []).find(bridge => bridge.device === item.device)?.members || [];
			const ports = names([ ...(item.ports || []).map(port => port.id), ...reported ]);
			if (!ports.length && item.device && item.type !== 'bridge')
				ports.push(item.device);
			for (const name of ports) {
				const device = devices.get(name) || {};
				if (device.type === 'wifi' || wirelessDevices.has(name))
					continue;
				const kind = [ 'tunnel', 'wireguard', 'vlan', 'vrf', 'alias' ].includes(device.type || item.type) ? 'virtual' : 'port';
				const speed = Number(device.speed);
				const speedText = speed > 0
					? '%s %s'.format(speed >= 1000 ? speed / 1000 : speed, speed >= 1000 ? _('Gbit/s') : _('Mbit/s'))
					: null;
				accessFor(group, 'device:' + name, {
					name, meta: speedText, device: name, kind, icon: kind === 'port' ? 'ethernet' : 'devices',
					active: device.carrier === null || device.carrier === undefined ? null : device.carrier,
					detail: [ kind === 'virtual' ? (item.protocol || _('Virtual interface')) : _('Network interface'),
						device.carrier === true ? _('Link up') : device.carrier === false ? _('Link down') : _('Link state unknown'),
						speedText ].filter(Boolean).join(' · ')
				});
			}
		}

		const hosts = new Map();
		const remember = item => {
			const mac = macAddress(item?.mac);
			if (!mac || localMACs.has(mac))
				return null;
			let host = hosts.get(mac);
			if (!host) {
				host = { mac, name: mac, addresses: [], keys: new Set() };
				hosts.set(mac, host);
			}
			if (text(item.name) && item.name !== '?' && item.name.toUpperCase() !== mac)
				host.name = item.name;
			for (const raw of Array.isArray(item.addresses) ? item.addresses : [ item.address ]) {
				const address = text(raw), key = addressKey(address);
				if (key && !host.keys.has(key)) {
					host.keys.add(key);
					host.addresses.push(address);
				}
			}
			return host;
		};
		for (const item of connections.hosts || [])
			remember(item);
		for (const item of observations.neighbours || [])
			remember(item);
		for (const bridge of observations.bridges || [])
			for (const entry of bridge.entries || [])
				remember(entry);

		const groupsByDevice = new Map();
		for (const group of groups.values()) {
			if (!group.device)
				continue;
			let list = groupsByDevice.get(group.device);
			if (!list)
				groupsByDevice.set(group.device, list = []);
			list.push(group);
		}

		const attach = (group, host, access, relation, evidence) => {
			if (!host || group.macs?.has(host.mac))
				return;
			if (access === 'unlocated')
				accessFor(group, access, { name: _('Interface not identified'), icon: 'devices', kind: 'unknown', detail: _('Network known; interface not identified') });
			const primaryIp = host.addresses[0]?.replace(/\/\d+$/, '');
			addMember(group, {
				id: group.id + '|' + host.mac, mac: host.mac, name: host.name, icon: 'devices',
				network: group.network, access, addresses: host.addresses.slice(), relation,
				detail: primaryIp || (host.name.toUpperCase() !== host.mac ? host.mac : ''), context: evidence
			});
		};
		for (const bridge of observations.bridges || []) {
			const owners = groupsByDevice.get(bridge.device);
			if (!bridge.available || owners?.length !== 1)
				continue;
			const group = owners[0], locations = new Map();
			for (const entry of bridge.entries || []) {
				const mac = macAddress(entry.mac);
				if (!mac || !entry.port)
					continue;
				if (!locations.has(mac))
					locations.set(mac, entry.port);
				else if (locations.get(mac) !== entry.port)
					locations.set(mac, null); // More than one reported port.
			}
			for (const [ mac, port ] of locations) {
				if (port) {
					if (!group.accessById?.has('device:' + port))
						continue;
					attach(group, hosts.get(mac), 'device:' + port, 'observed', _('Discovered via %s').format(port));
				}
				else {
					attach(group, hosts.get(mac), 'unlocated', 'logical', _('Multiple interfaces reported'));
				}
			}
		}
		for (const neighbour of observations.neighbours || []) {
			const mac = macAddress(neighbour.mac);
			const owners = mac ? groupsByDevice.get(neighbour.device) : null;
			if (owners?.length !== 1)
				continue;
			const group = owners[0], addrKey = addressKey(neighbour.address);
			if (group.type !== 'bridge' && !group.radios && upstreamList.some(up =>
				up.names.includes(group.network) && up.gateways.includes(addrKey)))
				continue;
			attach(group, hosts.get(mac), 'unlocated', 'logical', _('Address observed on %s').format(neighbour.device));
		}

		for (const group of groups.values()) {
			// Sort once; each access inherits the same order as the network.
			group.members.sort(byId);
			for (const member of group.members)
				group.accessById.get(member.access).members.push(member);
			group.access = Array.from(group.accessById?.values() || []);
			delete group.accessById;
			const deviceCount = group.macs?.size || 0;
			delete group.macs;
			const count = group.members.length;
			const quantity = group.kind === 'peer'
				? N_(count, '%d reported peer', '%d reported peers').format(count)
				: N_(count, '%d wireless association', '%d wireless associations').format(count);
			group.detail = [ group.context, count ? quantity : group.errors.length ? _('Data unavailable') : group.active ? _('Link up') : _('Link down') ].filter(Boolean).join(' · ');
			group.summary = count ? quantity : group.errors.length ? _('Wireless association data unavailable.')
				: group.radios ? _('No wireless associations reported.') : _('Endpoint attachment not reported.');
			const ports = group.access?.filter(access => access.kind === 'port' || access.kind === 'virtual') || [];
			if (ports.length || group.members.some(member => member.access?.startsWith('device:') || member.access === 'unlocated')) {
				group.detail = [
					group.context,
					ports.length ? N_(ports.length, '%d interface', '%d interfaces').format(ports.length) : null,
					deviceCount ? N_(deviceCount, '%d device', '%d devices').format(deviceCount) : null
				].filter(Boolean).join(' · ');
				group.summary = count ? N_(count, '%d device', '%d devices').format(count) : _('No endpoint attachment reported.');
			}
			if (group.kind === 'logical') {
				group.detail = count ? N_(deviceCount, '%d device', '%d devices').format(deviceCount)
					: group.errors.length ? _('Data unavailable') : group.active === true ? _('Link up')
						: group.active === false ? _('Link down') : _('Link state unknown');
				if (!count && !group.errors.length && typeof(group.active) === 'boolean')
					group.status = group.active ? 'up' : 'down';
			}
			if (count && group.errors.length) {
				group.detail = _('%s (partial)').format(group.detail);
				group.summary += ' · ' + _('Some wireless data is unavailable.');
			}
		}

		return {
			router: { id: 'router', name: text(router.hostname) || text(router.model) || _('This device'), detail: text(router.managementAddress) || text(router.model), icon: 'router', tab: 'system' },
			upstreams: upstreamList.sort(byId),
			groups: Array.from(groups.values()).filter(group => !(
				upstreamList.some(up => up.names.includes(group.network)) &&
				([ 'dhcp', 'dhcpv6', 'pppoe', 'ppp', 'qmi', 'mbim', 'ncm', '3g' ].includes(group.protocol) || [ 'tunnel', 'wireguard' ].includes(group.type)) &&
				!group.radios && !group.members.length
			)).sort(byId),
			interfacesAvailable: Array.isArray(connections.interfaces),
			wifiAvailable: source.wifi != null,
			wifiSupported: source.wifiSupported ?? source.wifi != null,
			partial: !connections.observations || !!observations.partial || (observations.bridges || []).some(bridge => bridge.partial)
		};
	}
});
