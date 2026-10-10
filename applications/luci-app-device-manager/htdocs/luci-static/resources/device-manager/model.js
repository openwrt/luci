// SPDX-License-Identifier: MIT
'use strict';
'require baseclass';

const ACTIVE_STATES = [ 'REACHABLE', 'DELAY', 'PROBE' ];
const STATE_PRIORITY = { REACHABLE: 6, DELAY: 5, PROBE: 4, STALE: 3, PERMANENT: 2, NOARP: 2, INCOMPLETE: 1, FAILED: 0 };

// Localize untouched defaults; user-defined names remain literal configuration data.
const DEFAULT_GROUPS = {
	smart_home: { stored: [ '智能家居', 'Smart home' ], label: () => _('Smart home') },
	phone: { stored: [ '手机设备', 'Phones' ], label: () => _('Phones') },
	computer: { stored: [ '电脑设备', 'Computers' ], label: () => _('Computers') },
	network: { stored: [ '网络设备', 'Network devices' ], label: () => _('Network devices') },
	other: { stored: [ '其他设备', 'Other devices' ], label: () => _('Other devices') }
};

const DEVICE_TYPES = {
	computer: { id: 'computer', icon: 'computer.svg', label: () => _('Computer') },
	laptop:   { id: 'laptop',   icon: 'laptop.svg',   label: () => _('Laptop') },
	phone:    { id: 'phone',    icon: 'phone.svg',    label: () => _('Phone') },
	tablet:   { id: 'tablet',   icon: 'tablet.svg',   label: () => _('Tablet') },
	tv:       { id: 'tv',       icon: 'tv.svg',       label: () => _('TV') },
	tvbox:    { id: 'tvbox',    icon: 'tvbox.svg',    label: () => _('TV box') },
	nas:      { id: 'nas',      icon: 'nas.svg',      label: () => _('NAS') },
	printer:  { id: 'printer',  icon: 'printer.svg',  label: () => _('Printer') },
	camera:   { id: 'camera',   icon: 'camera.svg',   label: () => _('Camera') },
	speaker:  { id: 'speaker',  icon: 'speaker.svg',  label: () => _('Speaker') },
	game:     { id: 'game',     icon: 'game.svg',     label: () => _('Game console') },
	router:   { id: 'router',   icon: 'router.svg',   label: () => _('Router') },
	switch:   { id: 'switch',   icon: 'switch.svg',   label: () => _('Switch') },
	ap:       { id: 'ap',       icon: 'ap.svg',       label: () => _('Access point') },
	server:   { id: 'server',   icon: 'server.svg',   label: () => _('Server') },
	plug:     { id: 'plug',     icon: 'plug.svg',     label: () => _('Smart plug') },
	light:    { id: 'light',    icon: 'light.svg',    label: () => _('Smart light') },
	sensor:   { id: 'sensor',   icon: 'sensor.svg',   label: () => _('Sensor') },
	home:     { id: 'home',     icon: 'home.svg',     label: () => _('Smart home') },
	watch:    { id: 'watch',    icon: 'watch.svg',    label: () => _('Watch') },
	car:      { id: 'car',      icon: 'car.svg',      label: () => _('Vehicle') },
	vr:       { id: 'vr',       icon: 'vr.svg',       label: () => _('VR headset') },
	network:  { id: 'network',  icon: 'network.svg',  label: () => _('Network device') },
	airconditioner: { id: 'airconditioner', icon: 'airconditioner.svg', label: () => _('Air conditioner') },
	washer:         { id: 'washer',         icon: 'washer.svg',         label: () => _('Washing machine') },
	fridge:         { id: 'fridge',         icon: 'fridge.svg',         label: () => _('Refrigerator') },
	waterpurifier:  { id: 'waterpurifier',  icon: 'waterpurifier.svg',  label: () => _('Water purifier') },
	airpurifier:    { id: 'airpurifier',    icon: 'airpurifier.svg',    label: () => _('Air purifier') },
	unknown:  { id: 'unknown',  icon: 'unknown.svg',  label: () => _('Unknown') }
};

// Small, documented vendor hints, not a fingerprint database. See docs/device-identification.md.
// Broad vendors such as Apple, Google and HP do not imply one device type.
const OUI_MAP = {
	'001132': 'nas', '4CFCAA': 'car', '2C2617': 'vr',
	'1012FB': 'camera', '0009BF': 'game', '000E58': 'speaker',
	'001788': 'light', '18FE34': 'home', '54EF44': 'home',
	'00156D': 'network', '000FE2': 'network', '000C42': 'router',
	'B827EB': 'computer'
};

function getTypeInfo(type) {
	return DEVICE_TYPES[type] || DEVICE_TYPES.unknown;
}

function getTypeLabel(type) {
	const info = getTypeInfo(type);
	return info.label();
}

function detectDeviceType(mac, hostname, customName, group) {
	const normalized = normalizeMac(mac);
	if (!normalized) return 'unknown';
	const text = (String(customName || '') + ' ' + String(hostname || '')).toLowerCase();
	// Specific device names precede broad vendor hints. Short tokens require
	// boundaries: "Cambridge-PC" is not "cam"; a network switch is not a console.
	const clues = [
		[ 'car', /(^|[^a-z0-9])(tesla|model[-_ ]*[3ysx]|byd|nio|xpeng|li-auto|polestar|rivian|zeekr)(?=$|[^a-z0-9])/ ],
		[ 'vr', /(^|[^a-z0-9])(quest|oculus|pico|vive|vision[-_ ]?pro|vr)(?=$|[^a-z0-9])/ ],
		[ 'nas', /(^|[^a-z0-9])(synology|diskstation|qnap|truenas|freenas|unraid|asustor|terramaster|openmediavault|omv|nas)(?=$|[^a-z0-9])/ ],
		[ 'printer', /(^|[^a-z0-9])(printer|laserjet|deskjet|epson|xerox|print)(?=$|[^a-z0-9])/ ],
		[ 'camera', /(^|[^a-z0-9])(camera|cctv|ipc|cam|webcam|hikvision|dahua|reolink|uniview|ezviz|wyze|imou)(?=$|[^a-z0-9])/ ],
		[ 'game', /(^|[^a-z0-9])(playstation|ps[345]|xbox|nintendo|steamdeck|gamepad)(?=$|[^a-z0-9])/ ],
		[ 'speaker', /(^|[^a-z0-9])(homepod|echo|alexa|sonos|soundbar|speaker|xiaoai)(?=$|[^a-z0-9])/ ],
		[ 'tvbox', /(^|[^a-z0-9])(appletv|apple-tv|chromecast|mibox|mi-box|firetv|fire-tv|firestick|roku|shield-tv|tvbox|tv-box|stb)(?=$|[^a-z0-9])/ ],
		[ 'tv', /(^|[^a-z0-9])(smarttv|smart-tv|mitv|mi-tv|bravia|tizen|webos|tv)(?=$|[^a-z0-9])/ ],
		[ 'watch', /(^|[^a-z0-9])(applewatch|apple-watch|iwatch|galaxy-watch|smartwatch|fitbit|garmin|watch|band)(?=$|[^a-z0-9])/ ],
		[ 'tablet', /(^|[^a-z0-9])(ipad|tablet|tab|mediapad|pad)(?=$|[^a-z0-9])/ ],
		[ 'laptop', /(^|[^a-z0-9])(macbook|laptop|thinkpad|notebook|zenbook|ideapad|matebook|surface-laptop|latitude|inspiron|xps)(?=$|[^a-z0-9])/ ],
		[ 'server', /(^|[^a-z0-9])(server|pve|proxmox|esxi|vmware|docker|kubernetes|k8s)(?=$|[^a-z0-9])/ ],
		[ 'computer', /(^|[^a-z0-9])(desktop|imac|macmini|macstudio|macpro|pc|tower|workstation|optiplex|windows)(?=$|[^a-z0-9])/ ],
		[ 'airconditioner', /(^|[^a-z0-9])(airconditioner|air-conditioner|aircon|air_cond|hvac|ac-unit|ac_unit)(?=$|[^a-z0-9])|空调/ ],
		[ 'washer', /(^|[^a-z0-9])(washer|washing-machine|washingmachine|dryer|laundry)(?=$|[^a-z0-9])|洗衣机|烘干机/ ],
		[ 'fridge', /(^|[^a-z0-9])(fridge|refrigerator|freezer)(?=$|[^a-z0-9])|冰箱|冷柜/ ],
		[ 'waterpurifier', /(^|[^a-z0-9])(waterpurifier|water-purifier)(?=$|[^a-z0-9])|净水器|直饮机|净水机/ ],
		[ 'airpurifier', /(^|[^a-z0-9])(airpurifier|air-purifier)(?=$|[^a-z0-9])|空净|空气净化/ ],
		[ 'phone', /(^|[^a-z0-9])(iphone|galaxy|redmi|xiaomi|huawei|honor|pixel|oneplus|oppo|vivo|xperia|realme|meizu|phone|mobile)(?=$|[^a-z0-9])/ ],
		[ 'plug', /(^|[^a-z0-9])(smartplug|smart-plug|socket|outlet|plug)(?=$|[^a-z0-9])/ ],
		[ 'light', /(^|[^a-z0-9])(smartlight|smart-light|light|bulb|lamp|yeelight|hue|strip)(?=$|[^a-z0-9])/ ],
		[ 'sensor', /(^|[^a-z0-9])(sensor|temp|humidity|motion|door|window|detector)(?=$|[^a-z0-9])/ ],
		[ 'home', /(^|[^a-z0-9])(homeassistant|hass|homebridge|aqara|hub|smart-home|smarthome)(?=$|[^a-z0-9])/ ],
		[ 'ap', /(^|[^a-z0-9])(accesspoint|unifi|uap|eap|ap)(?=$|[^a-z0-9])/ ],
		[ 'switch', /(^|[^a-z0-9])(switch|usw|tl-sg)(?=$|[^a-z0-9])|交换机/ ],
		[ 'router', /(^|[^a-z0-9])(router|openwrt|gateway|ax[0-9]{4}|ac[0-9]{4}|archer|asuswrt)(?=$|[^a-z0-9])/ ]
	];
	for (const [ type, pattern ] of clues) if (pattern.test(text)) return type;
	// Locally administered/randomized MACs have no reliable vendor prefix.
	if (!(parseInt(normalized.slice(0, 2), 16) & 2)) {
		const oui = normalized.replace(/:/g, '').slice(0, 6);
		if (OUI_MAP[oui]) return OUI_MAP[oui];
	}
	const groupTypes = { smart_home: 'home', phone: 'phone', computer: 'computer', network: 'network' };
	return groupTypes[group] || 'unknown';
}

function normalizeMac(mac) {
	if (typeof mac !== 'string') return null;
	const value = mac.trim().toUpperCase().replace(/[:-]/g, '');
	if (!/^[0-9A-F]{12}$/.test(value) || /^(0{12}|F{12})$/.test(value)) return null;
	return value.match(/.{2}/g).join(':');
}

function sanitizeInput(value) {
	return value == null ? '' : String(value).replace(/[\x00-\x1f\x7f]/g, ' ').trim();
}

function sectionMac(section) {
	return normalizeMac(section.mac) || normalizeMac((section['.name'] || '').replace(/^dev_/, ''));
}

function groupName(groups, id) {
	const group = groups.find(g => g.id === id);
	return group ? group.name : _('Ungrouped');
}

function matchesDevice(device, groups, group, query) {
	if (group !== 'all' && device.group !== group) return false;
	if (!query) return true;
	const typeInfo = getTypeInfo(device.type);
	return [ device.customName, device.hostname, device.ipv4, device.ipv6, device.mac,
		device.remark, groupName(groups, device.group),
		typeInfo.label(), device.type ].some(value => String(value || '').toLowerCase().includes(query));
}

function parseDevices(data, groups) {
	const devices = new Map();
	const addresses = new Map();
	const addressInterfaces = new Map();
	const neighborStates = new Map();
	const wifi = new Set();
	const arp = new Set();
	const getEntry = mac => {
		const normalized = normalizeMac(mac);
		if (!normalized) return null;
		if (!devices.has(normalized)) devices.set(normalized, {
			mac: normalized, hostname: '', ipv4: '', ipv6: '', customName: '', remark: '',
			group: 'ungrouped', sid: null, isSaved: false, isDiscovered: false,
			status: 'unknown', statusDetail: '', type: 'unknown',
			ipv4Addresses: [], ipv6Addresses: [], interfaces: [], discoverySources: [], neighbors: []
		});
		return devices.get(normalized);
	};
	const addAddress = (device, ip, preferred, iface) => {
		if (!device || typeof ip !== 'string' || !ip) return;
		// DHCPv6 may include a prefix length. Keep address matching consistent.
		const address = ip.split('/')[0].toLowerCase();
		if (!addresses.has(address)) addresses.set(address, new Set());
		addresses.get(address).add(device.mac);
		if (iface) {
			if (!addressInterfaces.has(address)) addressInterfaces.set(address, new Set());
			addressInterfaces.get(address).add(iface);
		}
		const field = address.includes(':') ? 'ipv6' : 'ipv4';
		if (!device[field + 'Addresses'].includes(address)) device[field + 'Addresses'].push(address);
		if (iface && !device.interfaces.includes(iface)) device.interfaces.push(iface);
		if (!device[field] || preferred) device[field] = address;
	};
	const addSource = (device, source) => {
		if (!device.discoverySources.includes(source)) device.discoverySources.push(source);
	};
	const toArray = value => Array.isArray(value) ? value : value == null ? [] : [ value ];
	const leases = data.leases || {};
	for (const lease of [ ...toArray(leases.dhcp_leases), ...toArray(leases.dhcp6_leases) ]) {
		const device = getEntry(lease.macaddr);
		if (!device) continue;
		device.isDiscovered = true;
		addSource(device, 'DHCP');
		device.hostname = sanitizeInput(lease.hostname || device.hostname);
		for (const ip of [ ...toArray(lease.ipaddr), ...toArray(lease.ip6addrs || lease.ip6addr) ]) addAddress(device, ip);
	}
	for (const [ mac, hint ] of Object.entries(data.hints || {})) {
		const device = getEntry(mac);
		if (!device || !hint || typeof hint !== 'object') continue;
		device.isDiscovered = true;
		addSource(device, 'Host hints');
		if (!device.hostname) device.hostname = sanitizeInput(hint.name);
		for (const ip of [ ...toArray(hint.ipaddrs || hint.ipv4), ...toArray(hint.ip6addrs || hint.ipv6) ]) addAddress(device, ip);
	}
	for (const section of data.devices || []) {
		const device = getEntry(sectionMac(section));
		if (!device) continue;
		device.isSaved = true;
		device.sid = section['.name'];
		device.customName = sanitizeInput(section.name);
		device.remark = sanitizeInput(section.remark);
		device.group = groups.some(g => g.id === section.group) ? section.group : 'ungrouped';
		if (section.type) device.customType = sanitizeInput(section.type);
	}
	for (const station of data.wifi || []) {
		const device = getEntry(typeof station === 'string' ? station : station.mac);
		if (!device) continue;
		device.isDiscovered = true;
		addSource(device, 'Wi-Fi');
		if (station.dev && !device.interfaces.includes(station.dev)) device.interfaces.push(station.dev);
		wifi.add(device.mac);
	}
	for (const entry of data.arp || []) {
		const device = getEntry(entry.mac);
		if (!device) continue;
		device.isDiscovered = true;
		addSource(device, 'ARP');
		addAddress(device, entry.ip, false, entry.dev);
		if (Number(entry.flags) === 2) arp.add(device.mac);
	}
	const neighbors = (data.neighbors || {}).neighbors || [];
	// Index all resolved neighbors first, so FAILED association is order independent.
	for (const neighbor of neighbors) {
		const device = getEntry(neighbor.mac);
		if (!device) continue;
		device.isDiscovered = true;
		addAddress(device, neighbor.ip, ACTIVE_STATES.includes(neighbor.state), neighbor.dev);
	}
	for (const neighbor of neighbors) {
		let mac = normalizeMac(neighbor.mac);
		if (!mac && typeof neighbor.ip === 'string') {
			const address = neighbor.ip.split('/')[0].toLowerCase();
			const interfaces = addressInterfaces.get(address);
			if (neighbor.dev && interfaces && !interfaces.has(neighbor.dev)) continue;
			const owners = addresses.get(address);
			// Never attach a failure to an ambiguous or reassigned address.
			if (owners && owners.size === 1) mac = owners.values().next().value;
		}
		if (!mac || !devices.has(mac)) continue;
		const device = devices.get(mac);
		addSource(device, 'Neighbor table');
		device.neighbors.push({ ip: neighbor.ip || '', dev: neighbor.dev || '', state: neighbor.state || '' });
		if (neighbor.dev && !device.interfaces.includes(neighbor.dev)) device.interfaces.push(neighbor.dev);
		const state = String(neighbor.state || '').toUpperCase();
		const previous = neighborStates.get(mac);
		if (previous == null || (STATE_PRIORITY[state] ?? -1) > (STATE_PRIORITY[previous] ?? -1)) neighborStates.set(mac, state);
	}
	const complete = data.discoveryComplete === true;
	for (const device of devices.values()) {
		device.type = (device.customType && device.customType !== 'auto')
			? device.customType
			: detectDeviceType(device.mac, device.hostname, device.customName, device.group);
		const state = neighborStates.get(device.mac);
		if (wifi.has(device.mac)) {
			device.status = 'online';
			device.statusDetail = _('Active Wi-Fi association');
		} else if (ACTIVE_STATES.includes(state)) {
			device.status = 'online';
			device.statusDetail = _('Active network neighbor (%s)').format(state);
		} else if (state === 'FAILED') {
			device.status = 'offline';
			device.statusDetail = _('Network neighbor probe failed (FAILED)');
		} else if (!complete) {
			device.statusDetail = _('Some discovery sources are unavailable');
		} else if (!device.isDiscovered && !state && device.isSaved) {
			device.status = 'offline';
			device.statusDetail = _('Saved device not found in the current network');
		} else if (state) {
			device.statusDetail = _('No recent activity confirmed (%s)').format(state);
		} else if (arp.has(device.mac)) {
			device.statusDetail = _('ARP record exists without recent activity evidence');
		} else {
			device.statusDetail = _('Known device without recent activity evidence');
		}
	}
	const statusOrder = { online: 0, unknown: 1, offline: 2 };
	return Array.from(devices.values()).sort((a, b) => {
		if (a.status !== b.status) return statusOrder[a.status] - statusOrder[b.status];
		if (!!a.ipv4 !== !!b.ipv4) return a.ipv4 ? -1 : 1;
		if (a.ipv4 && b.ipv4) {
			const left = a.ipv4.split('.').map(Number), right = b.ipv4.split('.').map(Number);
			for (let i = 0; i < 4; i++) if (left[i] !== right[i]) return left[i] - right[i];
		}
		return a.mac.localeCompare(b.mac);
	});
}

function parseIpv4(ip) {
	if (!ip || typeof ip !== 'string') return null;
	const parts = ip.split('.').map(Number);
	if (parts.length !== 4 || parts.some(n => isNaN(n) || n < 0 || n > 255)) return null;
	return parts;
}

function sortDevices(devices, sortKey, sortDir, getGroupName) {
	if (!sortKey || !Array.isArray(devices)) return devices || [];
	const dir = (sortDir === 'desc') ? -1 : 1;
	return devices.slice().sort((a, b) => {
		if (sortKey === 'ip') {
			const pa = parseIpv4(a.ipv4);
			const pb = parseIpv4(b.ipv4);
			// Devices with valid IPv4 always appear before devices without IPv4
			if (Boolean(pa) !== Boolean(pb)) {
				return pa ? -1 : 1;
			}
			if (pa && pb) {
				for (let i = 0; i < 4; i++) {
					if (pa[i] !== pb[i]) return (pa[i] - pb[i]) * dir;
				}
			}
			// Both lack IPv4 (or identical IPv4): check IPv6
			const v6a = a.ipv6 || '';
			const v6b = b.ipv6 || '';
			if (Boolean(v6a) !== Boolean(v6b)) {
				return v6a ? -1 : 1;
			}
			if (v6a && v6b) {
				const cmpV6 = v6a.localeCompare(v6b);
				if (cmpV6 !== 0) return cmpV6 * dir;
			}
			// Tie-breaker: MAC
			return (a.mac || '').localeCompare(b.mac || '') * dir;
		}

		if (sortKey === 'name') {
			const nameA = a.customName || a.hostname || '';
			const nameB = b.customName || b.hostname || '';
			if (Boolean(nameA) !== Boolean(nameB)) return nameA ? -1 : 1;
			if (nameA && nameB) {
				const cmp = nameA.localeCompare(nameB);
				if (cmp !== 0) return cmp * dir;
			}
			return (a.mac || '').localeCompare(b.mac || '') * dir;
		}

		if (sortKey === 'mac') {
			return (a.mac || '').localeCompare(b.mac || '') * dir;
		}

		if (sortKey === 'group') {
			const gA = (typeof getGroupName === 'function' ? getGroupName(a.group) : a.group) || '';
			const gB = (typeof getGroupName === 'function' ? getGroupName(b.group) : b.group) || '';
			if (Boolean(gA) !== Boolean(gB)) return gA ? -1 : 1;
			if (gA && gB) {
				const cmp = gA.localeCompare(gB);
				if (cmp !== 0) return cmp * dir;
			}
			return (a.mac || '').localeCompare(b.mac || '') * dir;
		}

		if (sortKey === 'type') {
			const tA = a.type || '';
			const tB = b.type || '';
			if (tA !== tB) return tA.localeCompare(tB) * dir;
			return (a.mac || '').localeCompare(b.mac || '') * dir;
		}

		return 0;
	});
}

return baseclass.extend({
	DEVICE_TYPES: DEVICE_TYPES,
	detectDeviceType: detectDeviceType,
	getTypeInfo: getTypeInfo,
	getTypeLabel: getTypeLabel,
	normalizeMac: normalizeMac,
	sanitizeInput: sanitizeInput,
	sectionMac: sectionMac,
	getSectionId: mac => 'dev_' + normalizeMac(mac).replace(/:/g, '').toLowerCase(),
	groupName: groupName,
	matchesDevice: matchesDevice,
	parseDevices: parseDevices,
	sortDevices: sortDevices,
	parseGroups: sections => (sections || []).map(section => {
		const id = section['.name'], name = sanitizeInput(section.name) || id;
		const defaults = DEFAULT_GROUPS[id];
		return { id: id, name: defaults && defaults.stored.includes(name) ? defaults.label() : name };
	}),
	parseArp: content => String(content || '').trim().split('\n').slice(1).map(line => {
		const fields = line.trim().split(/\s+/);
		return { ip: fields[0], flags: fields[2], mac: fields[3], dev: fields[5] };
	}).filter(entry => entry.dev && normalizeMac(entry.mac))
});
