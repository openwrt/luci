/*
 * Copyright (C) 2008-2026 The OpenWrt Project
 * Copyright (C) 2026 Manfred Jaider <info@masmbit.com>
 *
 * This is free software, licensed under the Apache License, Version 2.0.
 * See /LICENSE for more information.
 *
 * luci-app-openvpn-plus : shared status class
 * /www/luci-static/resources/view/vpn/openvpn-status.js
 *
 * 1. --- TEXT & CONSTANTS --- ..... Global translations and constants
 * 2. --- HELPER --- ............... Router connections and file setup
 * 3. --- STATUS VIEW --- .......... Live statistics and traffic tables
 */

/* global E */
'use strict';

/*
 * --- TEXT & CONSTANTS ---
 */
const TXT = {
	INFO: {
		active_pids: _('Active PIDs'),
		aggregated_rx: _('Aggregated RX'),
		aggregated_tx: _('Aggregated TX'),
		creating: _('Creating...'),
		client: _('Client'),
		connected: _('Connected'),
		server: _('Server'),
		disabled: _('Disabled'),
		error: _('Error'),
		enabled: _('Enabled'),
		instance: _('Instance'),
		instance_x: _('Instance #'),
		instances: _('Instances'),
		yes: _('Yes'),
		no: _('No'),
		no_clients_connected: _('No clients connected'),
		no_server_connected: _('No server connected'),
		pending: _('Pending...'),
		running: _('Running'),
		since: _('Since'),
		status: _('Status'),
		session: _('Session'),
		transfer: _('Transfer'),
		encryption: _('Encryption'),
		local_ip_port: _('Local IP / Port'),
		no_inst: _('No instances configured'),
		remote_ip_port: _('Remote IP / Port'),
		type: _('Type'),
		uptime: _('UpTime'),
		vpn: _('VPN')
	}
};

const CFG = Object.freeze({
	FILE: Object.freeze({
		dir_cfg: '/etc/openvpn/luci/',
		proc_uptime: '/proc/uptime',
		vpn_disabled_img: '/luci-static/resources/icons/tunnel_disabled.svg',
		vpn_enabled_img: '/luci-static/resources/icons/tunnel.svg'
	}),
	LIBEXEC: Object.freeze({
		luci_app_openvpn_plus: '/usr/libexec/luci-app-openvpn-plus',
		readstatus: 'readstatus',
		getmac: 'getmac',
		getnetstat: 'getnetstat',
		ovpnver: 'ovpnver',
	}),
	CMD: Object.freeze({
		openvpn: 'openvpn',
	}),
})

const OPENVPN = Object.freeze({
	ROLE: Object.freeze({
		SERVER: 'server',
		CLIENT: 'client'
	}),
	PROTO: Object.freeze({
		TCP: 'tcp',
		UDP: 'udp'
	}),
	PORT: Object.freeze({
		s1194: '1194'
	}),
	IPv4: Object.freeze({
		LOOPBACK: '127.0.0.1',
		MASK24: '255.255.255.0'
	}),
	STATE: Object.freeze({
		disabled: 'disabled',
		pending: 'pending',
		active: 'active',
		error: 'error'
	})
});

/**
 * Default structure template for single OpenVPN running instances
 */
const INSTANCE_TEMPLATE = Object.freeze({
	id: '',
	instNum: 1,
	devName: 'tun0',
	displayName: '',
	ddns: '',
	role: OPENVPN.ROLE.SERVER,
	port: 0,
	portExtern: 0,
	proto: 'udp',
	smartFirewall: false,
	serverSiteToSite: false,
	cipher: '-',
	localIp: '0.0.0.0',
	remoteClient: '-',
	remoteSubnets: null,
	loopbackServerId: null,
	confContent: '',
	isRunning: false,
	pid: '-',
	startTime: 0,
	clientRefresh: 60,
	netstat: null,
	useLogFilter: false,
	connectedClients: null
});

/**
 * Default structure for connectedClients
 */
const CLIENT_TEMPLATE = Object.freeze({
	commonName: '',
	realAddress: '',
	bytesReceived: 0,
	bytesSent: 0,
	connectedSince: '',
	timeMs: 0,
});

/*
 * --- HELPER ---
 */


/**
 * Caches static configuration structures to optimize system flash access
 */
const configAssetCache = {};
const statusFileCache = {};

const sanitizeInputText = function (value) {
	const rawText = value ? String(value).trim() : '';
	return rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
};

/**
 * Declare the native file read RPC once globally (LuCI caches this definition)
 */
const nativeFileReadRpc = L.rpc.declare({
	object: 'file',
	method: 'read',
	params: ['path']
});

/**
 * Native RPC wrapper to read a file as a plain string (replaces L.fs.read cleanly)
 */
const rpcReadFile = async function (path) {
	const res = await L.resolveDefault(nativeFileReadRpc(path), null);
	if (res && typeof res === 'object' && typeof res.data === 'string') {
		return res.data;
	}
	return null;
};

/**
 * Global single registration for file statistics (captures the full stat object)
 */
const nativeFileStatRpc = L.rpc.declare({
	object: 'file',
	method: 'stat',
	params: ['path']
});

/**
 * Native RPC wrapper to check file statistics (replaces L.fs.stat cleanly)
 */
const rpcStatFile = async function (filepath) {
	const res = await L.resolveDefault(nativeFileStatRpc(filepath), {});
	if (res && typeof res === 'object' && (typeof res.type === 'string' || typeof res.mtime === 'number')) {
		return res;
	}
	return null;
};

/**
 * Declare the native file exec RPC once globally (LuCI caches this definition)
 */
const nativeFileExecRpc = L.rpc.declare({
	object: 'file',
	method: 'exec',
	params: ['command', 'params']
});

/**
 * Wrapper for /usr/libexec/luci-app-openvpn-plus using the native ubus RPC directly
 */
const luci_app_openvpn_plus = async function (args) {
	const extraArgs = (typeof args === 'string') ? [args] : (Array.isArray(args) ? args : []);
	const res = await L.resolveDefault(nativeFileExecRpc(CFG.LIBEXEC.luci_app_openvpn_plus, extraArgs), {});
	if (res && typeof res === 'object' && typeof res.stdout === 'string') {
		return res.stdout.trim();
	}
	return '';
};

/**
 * Declare the native service list RPC once globally (LuCI caches this definition)
 */
const nativeServiceListRpc = L.rpc.declare({
	object: 'service',
	method: 'list',
	params: ['name'],
	expect: { 'openvpn': {} }
});

/**
 * Gets the active status of the OpenVPN service from ubus (replaces 'sh -c ubus' shell calls).
 */
const rpcGetServiceStatus = async function () {
	const res = await L.resolveDefault(nativeServiceListRpc(CFG.CMD.openvpn), {});
	if (res && typeof res === 'object') {
		return res;
	}
	return {};
};

/**
 * Gets the active dev name from uci (with default fallback)
 */
const getDevName = function (id, instNum, newinstance) {
	const defaultDevName = 'tun' + String(instNum - 1);
	if (newinstance) {
		// on a new instance devname ist not set in uci
		return defaultDevName;
	} else {
		const devName = L.uci.get(CFG.CMD.openvpn, id, 'devname');
		return devName || defaultDevName;
	}
}

/**
 * Checks if an OpenVPN instance is enabled
 */
const isInstanceEnabled = function (instance_id) {
	return L.uci.get(CFG.CMD.openvpn, instance_id, 'enabled') === '1';
};

/**
 * Checks if at least one OpenVPN instance is enabled in the configuration array
 */
const isAnyInstanceEnabled = function (ovpnUciSections) {
	const ovpnSections = Array.isArray(ovpnUciSections) ? ovpnUciSections : [];
	for (let i = 0; i < ovpnSections.length; i++) {
		if (ovpnSections[i] && ovpnSections[i]['.name'] && isInstanceEnabled(ovpnSections[i]['.name'])) {
			return true;
		}
	}
	return false;
};

const openVpnInfo = {
	macAddress: 0x0000,
	version: null,
	openssl: null,
	openssl_type: null,
	doc: null,
}

/**
 * Checks if at least one OpenVPN instance is enabled in the configuration array
 */
const getOpenVpnInfo = async function () {

	// get mac address
	let rawMac = await luci_app_openvpn_plus([CFG.LIBEXEC.getmac]);

	if (rawMac.length > 0 && rawMac !== '00:00:00:00:00:00') {
		const cleanMac = rawMac.replace(/[^a-fA-F0-9]/g, '');

		// Isolate the last 3 hex characters (12-bit entropy seed)
		if (cleanMac.length >= 3) {
			const lastThreeHex = cleanMac.substring(cleanMac.length - 3);

			// Save into the static memory register for all future allocations
			const parsedSeed = parseInt(lastThreeHex, 16);
			openVpnInfo.macAddress = !isNaN(parsedSeed) ? parsedSeed : 0x0000;
		}
	}

	// get ovpn version
	const rawVersion = await luci_app_openvpn_plus([CFG.LIBEXEC.ovpnver]);
	if (rawVersion.length > 0) {
		// Looks for "OpenVPN" followed by spaces, and stops at the first space or bracket.
		// This safely ignores git tags like [git:DSM7-...] or OS tags.
		const ovpnMatch = rawVersion.match(/OpenVPN\s+([0-9.]+)/);
		if (ovpnMatch && ovpnMatch[1]) {
			openVpnInfo.version = ovpnMatch[1];
		}

		// This searches for keywords like OpenSSL, mbedTLS, or wolfSSL followed by their numbers.
		const sslMatch = rawVersion.match(/(OpenSSL|mbedTLS|wolfSSL)\s+([0-9a-zA-Z.]+)/i);
		if (sslMatch) {
			// sslMatch[1] is the name (e.g. "OpenSSL"), sslMatch[2] is the version (e.g. "3.5.8")
			openVpnInfo.openssl = sslMatch[2];
			openVpnInfo.openssl_type = sslMatch[1];
		}

		// Looks for "DCO version:". If it finds "N/A", we keep the default 'Disabled' state.
		const dcoMatch = rawVersion.match(/DCO version:\s+([0-9.]+)/);
		if (dcoMatch && dcoMatch[1]) {
			openVpnInfo.dco = dcoMatch[1];
		}
	}
}

/**
 * Reads system uptime from the proc filesystem asynchronously
 */
const getSystemUptime = async function () {
	const rawUptime = await rpcReadFile(CFG.FILE.proc_uptime);
	// Split the output string by spaces to separate uptime and idle time
	const partsUptime = String(rawUptime || '0').trim().split(/\s+/);
	const uptime = (partsUptime && partsUptime[0]) ? parseFloat(partsUptime[0]) : 0;
	return uptime;
};

/**
 * Reads network statistics using parallel RPC requests and updates each instance object
 */
const refreshNetStat = async function (instances) {
	try {
		// Check if the input is a valid array with data
		if (!Array.isArray(instances) || instances.length === 0) {
			return;
		}

		// Reset all netstat fields to a default empty structure first
		for (let i = 0; i < instances.length; i++) {
			instances[i].netstat = {
				rxBytes: 0,
				txBytes: 0,
				rxPkts: 0,
				txPkts: 0,
				hasData: false
			};
		}

		const promises = [];

		// Step 1: Start RPC requests for running instances at the same time
		for (let j = 0; j < instances.length; j++) {
			const inst = instances[j];
			if (inst && inst.isRunning === true && inst.devName) {
				promises.push(luci_app_openvpn_plus([CFG.LIBEXEC.getnetstat, inst.devName]));
			}
		}

		// Step 2: Wait for all parallel backend calls to finish
		const results = await Promise.all(promises);

		// Step 3: Parse the results and map them directly into the correct instance
		for (let k = 0; k < results.length; k++) {
			const res_getnetstat = results[k] ? String(results[k]).trim() : '';
			const partsMetrics = res_getnetstat.split('|');

			// Check if the backend returned all 6 fields (rxb|txb|rxp|txp|status|iface)
			if (partsMetrics && partsMetrics.length === 6) {
				const ifaceName = partsMetrics[5];
				const isUp = (partsMetrics[4] === 'true');

				// Find the matching instance by comparing the device name
				for (let m = 0; m < instances.length; m++) {
					const targetInst = instances[m];
					const expectedDev = targetInst.devName;

					if (expectedDev === ifaceName) {
						targetInst.netstat.rxBytes = parseInt(partsMetrics[0], 10) || 0;
						targetInst.netstat.txBytes = parseInt(partsMetrics[1], 10) || 0;
						targetInst.netstat.rxPkts = parseInt(partsMetrics[2], 10) || 0;
						targetInst.netstat.txPkts = parseInt(partsMetrics[3], 10) || 0;
						targetInst.netstat.hasData = isUp;
						break;
					}
				}
			}
		}

		// Step 4: Sanity check to fix DCO kernel sync delays against active session bytes
		for (let n = 0; n < instances.length; n++) {
			const activeInst = instances[n];

			// Only compare if the instance is running and has connected clients
			if (activeInst && activeInst.isRunning === true && Array.isArray(activeInst.connectedClients)) {
				let totalClientRx = 0;
				let totalClientTx = 0;

				// Sum up the bytes from all currently connected clients
				for (let c = 0; c < activeInst.connectedClients.length; c++) {
					const client = activeInst.connectedClients[c];
					if (client) {
						totalClientRx += client.bytesReceived || 0;
						totalClientTx += client.bytesSent || 0;
					}
				}

				// If kernel statistics are lower than session bytes, force the session values
				if (activeInst.netstat.rxBytes < totalClientRx) {
					activeInst.netstat.rxBytes = totalClientRx;
					activeInst.netstat.hasData = true;
				}
				if (activeInst.netstat.txBytes < totalClientTx) {
					activeInst.netstat.txBytes = totalClientTx;
					activeInst.netstat.hasData = true;
				}
			}
		}

	} catch (err) {
		console.error('Error refreshing network data:', err);
	}
};


/**
 * Parses client IP addresses from the OpenVPN status log text file
 */
const parseConnectedClients = function (statusContent, inst) {
	const rawClients = [];
	if (!statusContent) {
		return rawClients;
	}
	const lines = statusContent.split('\n');
	const connectedClients = [];

	if (inst.role === OPENVPN.ROLE.CLIENT) {

		let logDateStr = '';
		let timestampMs = 0;
		let bytesRxInt = 0;
		let bytesTxInt = 0;

		// Loop through client stats lines to extract bytes and update time
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i].trim();
			if (line.length === 0) continue;

			// Extract the log update timestamp line
			if (line.indexOf('Updated,') === 0) {
				const datePart = line.split(',')[1];
				if (datePart) {
					const parsedDate = new Date(datePart.trim().replace(/-/g, '/'));
					if (!isNaN(parsedDate.getTime())) {
						logDateStr = parsedDate.toLocaleString();
						timestampMs = parsedDate.getTime();
					}
				}
			}
			// Extract read bytes (Bytes received from server perspective)
			else if (line.indexOf('TCP/UDP read bytes,') === 0) {
				bytesRxInt = parseInt(line.split(',')[1], 10) || 0;
			}
			// Extract write bytes (Bytes sent to server perspective)
			else if (line.indexOf('TCP/UDP write bytes,') === 0) {
				bytesTxInt = parseInt(line.split(',')[1], 10) || 0;
			}
		}

		// Read the persistent server common name directly from the UCI storage layer
		const serverCN = L.uci.get(CFG.CMD.openvpn, inst.id, 'server_common_name') || 'Remote Server';

		// Push the client structure into the return array connectedClients
		const client = Object.assign({}, CLIENT_TEMPLATE, {
			commonName: serverCN,
			realAddress: inst.remoteClient,
			bytesReceived: bytesRxInt,
			bytesSent: bytesTxInt,
			connectedSince: logDateStr || new Date().toLocaleString(),
			timeMs: timestampMs || new Date().getTime()
		});
		connectedClients.push(client);

	} else {

		let insideClientList = false;

		// Loop through rows to extract all initial raw client connections
		for (let c = 0; c < lines.length; c++) {
			const line = lines[c].trim();

			if (line.indexOf('OpenVPN CLIENT LIST') !== -1 || line.indexOf('Common Name,Real Address') !== -1) {
				insideClientList = true;
				continue;
			}

			if (line.indexOf('ROUTING TABLE') !== -1 || line.indexOf('GLOBAL STATS') !== -1 || line.indexOf('END') === 0) {
				break;
			}

			if (insideClientList && line.length > 0) {
				const tokens = line.split(',');

				if (tokens.length >= 5 && tokens[0] !== 'Common Name' && tokens[0] !== 'Updated') {
					const rawRealAddress = tokens[1].trim();
					const cleanRealAddress = rawRealAddress.replace(/[[\]]/g, '');

					let formattedDate = tokens[4].trim();
					let timestampMs = 0;
					const parsedClientDate = new Date(formattedDate.replace(/-/g, '/'));
					if (!isNaN(parsedClientDate.getTime())) {
						formattedDate = parsedClientDate.toLocaleString();
						timestampMs = parsedClientDate.getTime();
					}

					const bytesRxInt = parseInt(tokens[2].trim(), 10) || 0;
					const bytesTxInt = parseInt(tokens[3].trim(), 10) || 0;

					const client = Object.assign({}, CLIENT_TEMPLATE, {
						commonName: tokens[0].trim(),
						realAddress: cleanRealAddress,
						bytesReceived: bytesRxInt,
						bytesSent: bytesTxInt,
						connectedSince: formattedDate,
						timeMs: timestampMs
					});
					rawClients.push(client);
				}
			}
		}
		const youngestTimePerIp = {};

		// PASS 1: Find the newest connection timestamp for each IP address
		for (let i = 0; i < rawClients.length; i++) {
			const client = rawClients[i];

			// Extract base IP address without port
			let baseIp = client.realAddress;
			if (client.realAddress.indexOf('[') !== -1) {
				const ipv6Match = client.realAddress.match(/^\[(.*)\]:\d+$/);
				baseIp = ipv6Match ? ipv6Match[1].trim() : baseIp;
			} else {
				const lastColonIdx = client.realAddress.lastIndexOf(':');
				baseIp = (lastColonIdx !== -1) ? client.realAddress.substring(0, lastColonIdx).trim() : client.realAddress;
			}

			// Save the youngest timestamp for this IP
			if (baseIp && (!youngestTimePerIp[baseIp] || client.timeMs > youngestTimePerIp[baseIp])) {
				youngestTimePerIp[baseIp] = client.timeMs;
			}
		}

		// PASS 2: Only keep the newest connection for each IP address
		for (let j = 0; j < rawClients.length; j++) {
			const targetClient = rawClients[j];

			// Always drop UNDEF connections immediately
			if (targetClient.commonName === 'UNDEF') {
				continue;
			}

			// Extract base IP address without port
			let baseIp = targetClient.realAddress;
			if (targetClient.realAddress.indexOf('[') !== -1) {
				const ipv6Match = targetClient.realAddress.match(/^\[(.*)\]:\d+$/);
				baseIp = ipv6Match ? ipv6Match[1].trim() : baseIp;
			} else {
				const lastColonIdx = targetClient.realAddress.lastIndexOf(':');
				baseIp = (lastColonIdx !== -1) ? targetClient.realAddress.substring(0, lastColonIdx).trim() : targetClient.realAddress;
			}

			// Drop the connection if there is a newer connection for this IP
			if (baseIp && youngestTimePerIp[baseIp] && targetClient.timeMs < youngestTimePerIp[baseIp]) {
				continue;
			}

			connectedClients.push(targetClient);
		}
	}

	return connectedClients;
};

/**
 * Calculates a unique router-individual port using hexadecimal grid markers.
 */
const calcPortFromId = function (instance_id, optional_instance_number) {
	let instNum;
	if (optional_instance_number) {
		instNum = (typeof optional_instance_number === 'number') ? optional_instance_number : parseInt(optional_instance_number, 10);
		if (isNaN(instNum)) {
			instNum = getInstanceNumber(instance_id);
		}
	} else {
		instNum = getInstanceNumber(instance_id);
	}

	// Read instantly from the static OnLoad memory register
	if (openVpnInfo.macAddress !== null) {
		return 0xE000 + openVpnInfo.macAddress + instNum;
	}

	// Unwrapped hardware fallback if the interface was missing during OnLoad
	return 0xE000 + instNum;
};

/**
 * Extracts the OpenVPN port number from the configuration text safely
 */
const parsePortFromConfig = function (role, content) {
	if (!content) return null;

	let lines
	if (Array.isArray(content)) {
		lines = content;
	} else {
		lines = content.split('\n');
	}

	for (let i = 0; i < lines.length; i++) {
		let line = lines[i].trim();

		// Skip empty lines and full line comment markers
		if (line.length === 0 || line.charAt(0) === '#' || line.charAt(0) === ';') {
			continue;
		}

		// Strip inline comments from the end of the lines
		const hashIdx = line.indexOf('#');
		if (hashIdx !== -1) {
			line = line.substring(0, hashIdx).trim();
		}

		const semiIdx = line.indexOf(';');
		if (semiIdx !== -1) {
			line = line.substring(0, semiIdx).trim();
		}

		// Split spaces or tabs into clean text tokens
		const tokens = line.split(/\s+/);
		if (tokens.length < 2) {
			continue;
		}

		const directive = tokens[0].toLowerCase();

		// Server profile check: look for "port number" syntax
		if (role === OPENVPN.ROLE.SERVER && directive === 'port') {
			const portNum = parseInt(tokens[1], 10);
			if (!isNaN(portNum) && portNum > 0 && portNum <= 65535) {
				return portNum;
			}
		}

		// Client profile check: look for "remote host port" syntax
		if (role === OPENVPN.ROLE.CLIENT && directive === 'remote' && tokens.length >= 3) {
			const portNum = parseInt(tokens[2], 10);
			if (!isNaN(portNum) && portNum > 0 && portNum <= 65535) {
				return portNum;
			}
		}
	}

	return null;
};

/**
 * Extracts the OpenVPN protocol string (udp/tcp) from the configuration text safely
 */
const parseProtoFromConfig = function (content) {
	if (!content) return OPENVPN.PROTO.UDP;

	let lines
	if (Array.isArray(content)) {
		lines = content;
	} else {
		lines = content.split('\n');
	}

	for (let i = 0; i < lines.length; i++) {
		let line = lines[i].trim();
		if (line.length === 0 || line.charAt(0) === '#' || line.charAt(0) === ';') {
			continue;
		}
		const hashIdx = line.indexOf('#');
		if (hashIdx !== -1) line = line.substring(0, hashIdx).trim();
		const semiIdx = line.indexOf(';');
		if (semiIdx !== -1) line = line.substring(0, semiIdx).trim();

		const tokens = line.split(/\s+/);
		if (tokens.length < 2) continue;

		// Look for the "proto" directive line
		if (tokens[0].toLowerCase() === 'proto') {
			const protoVal = tokens[1].toLowerCase();
			// Handle standard openvpn proto values (udp, tcp, udp4, tcp4, udp6, tcp6)
			if (protoVal.indexOf(OPENVPN.PROTO.TCP) !== -1) return OPENVPN.PROTO.TCP;
			if (protoVal.indexOf(OPENVPN.PROTO.UDP) !== -1) return OPENVPN.PROTO.UDP;
			return protoVal;
		}
	}
	return OPENVPN.PROTO.UDP; // Default fallback matching standard OpenVPN defaults
};

/**
 * Safe parser to get ONLY the active dynamic DDNS domain name from the configuration file text
 */
const parseDdnsFromConfig = function (content) {
	if (!content) {
		return '';
	}

	// Example: setenv DDNS "my.ddns.net"

	// Match line with setenv DDNS followed by optional single or double quotes
	const ddnsMatch = content.match(/^setenv\s+DDNS\s+["']?([^"'\s\r\n]+)["']?$/m);

	if (ddnsMatch && ddnsMatch[1]) {
		return ddnsMatch[1].trim();
	}

	return '';
};

/**
 * Formats any IP and netmask cleanly into a mathematically correct NET IP/XX CIDR boundary (e.g. 192.168.1.5 -> 192.168.1.0/24).
 */
const netIPCIDR = function (raw_ip, raw_mask) {
	if (!raw_ip) return '';

	// (raw_mask === 'cidr') -> return NET IPv6/64 or NET IPv4/24
	// (raw_mask === null) -> return NET IP without CIDR

	// Flag to detect if the input IP already contains its own mask boundary
	const hasInlineCidr = raw_ip.includes('/');

	// --- IPv6 ---

	if (raw_ip.includes(':')) {
		let ip6Part = raw_ip;
		let prefix6 = '64';

		// Extract prefix if it is already inline (e.g. "fd00:db8::5/64")
		if (hasInlineCidr) {
			const parts6 = raw_ip.split('/');
			ip6Part = parts6[0];
			prefix6 = parts6[1];
		} else if (raw_mask && raw_mask !== 'cidr') {
			prefix6 = raw_mask;
		}

		// Expands short notation, splits into 16-bit blocks and zeroes out the host portion
		let blocks = [];

		// Handle double-colon expansion safely to get exactly 8 blocks
		if (ip6Part.includes('::')) {
			const splitColons = ip6Part.split('::');
			const leftBlocks = splitColons[0] ? splitColons[0].split(':') : [];
			const rightBlocks = splitColons[1] ? splitColons[1].split(':') : [];
			const missingCount = 8 - (leftBlocks.length + rightBlocks.length);

			for (let l = 0; l < leftBlocks.length; l++) blocks.push(leftBlocks[l]);
			for (let m = 0; m < missingCount; m++) blocks.push('0');
			for (let r = 0; r < rightBlocks.length; r++) blocks.push(rightBlocks[r]);
		} else {
			blocks = ip6Part.split(':');
		}

		// Normalize block hex values to numbers for bitwise calculations
		const parsedBlocks = [];
		for (let b = 0; b < 8; b++) {
			parsedBlocks.push(blocks[b] ? parseInt(blocks[b], 16) : 0);
		}

		// Calculate numeric bits to zero out from the back based on the prefix length
		const numPrefix6 = parseInt(prefix6, 10) || 64;
		for (let bit = 0; bit < 128; bit++) {
			if (bit >= numPrefix6) {
				const targetBlock = Math.floor(bit / 16);
				const targetBitInBlock = 15 - (bit % 16);
				parsedBlocks[targetBlock] &= ~(1 << targetBitInBlock);
			}
		}

		// Rebuild clean hex blocks stream
		const cleanedBlocks = [];
		for (let c = 0; c < 8; c++) {
			cleanedBlocks.push(parsedBlocks[c].toString(16));
		}

		// Shorten the output into standard zero compressed notation (::) for clean display
		let cleanNetIp6 = cleanedBlocks.join(':').replace(/(^|:)0:0(:0)*(:|$)/, '::');
		if (cleanNetIp6 === ':') cleanNetIp6 = '::';

		if (!raw_mask && !hasInlineCidr) {
			// Return NET IPv6 without CIDR suffix
			return cleanNetIp6;
		}
		// Return NET IPv6 with CIDR suffix
		return cleanNetIp6 + '/' + numPrefix6;
	}

	// --- IPv4 ---

	// Bitwise AND network identification matching
	const calculateNetId = function (ip, mask = OPENVPN.IPv4.MASK24) {
		const cleanMask = (mask === null || mask === '') ? OPENVPN.IPv4.MASK24 : mask;
		const ipOctets = ip.split('.').map(Number);
		let maskOctets = cleanMask.split('.').map(Number);
		// 1. If the input IP is broken or incomplete, bypass calculations and return the original string safely [s1]
		if (ipOctets.length < 4) {
			return ip;
		}
		// 2. If the mask is broken, override it immediately with the clean 24-bit matrix [s1]
		if (maskOctets.length < 4) {
			maskOctets = OPENVPN.IPv4.MASK24.split('.').map(Number);
		}
		// Symmetrical bitwise calculation layers
		const net1 = ipOctets[0] & maskOctets[0];
		const net2 = ipOctets[1] & maskOctets[1];
		const net3 = ipOctets[2] & maskOctets[2];
		const net4 = ipOctets[3] & maskOctets[3];
		return net1 + '.' + net2 + '.' + net3 + '.' + net4;
	};

	// Iterative bitmask to bitcount prefix translation
	const getCidrNet = function (ip, mask) {
		const maskOctets = mask ? mask.split('.').map(Number) : [];
		let cidr = 0;
		if (maskOctets.length < 4) {
			return ip + '/24';
		}
		// The for-loop iterates over each octet
		for (let i = 0; i < maskOctets.length; i++) {
			const octet = maskOctets[i];
			if (octet === 255) {
				cidr += 8;
			} else {
				if (octet === 254) cidr += 7;
				else if (octet === 252) cidr += 6;
				else if (octet === 248) cidr += 5;
				else if (octet === 240) cidr += 4;
				else if (octet === 224) cidr += 3;
				else if (octet === 192) cidr += 2;
				else if (octet === 128) cidr += 1;
				// Break instantly if octet is smaller than 255 or hits 0
				break;
			}
		}
		// Symmetrical validation: If calculation fails or hits an invalid mask (like 0.0.0.0), enforce 24
		if (cidr === 0) {
			cidr = 24;
		}
		return ip + '/' + cidr;
	};

	let inputIp = raw_ip;
	let inputMask = raw_mask;

	// Handle extraction if input brings an inline prefix (e.g. "192.168.1.5/24")
	if (hasInlineCidr) {
		const parts4 = raw_ip.split('/');
		inputIp = parts4[0];
		const inlinePrefix = parseInt(parts4[1], 10) || 24;

		// Rebuild explicit netmask format string from the prefix
		const maskArray = [0, 0, 0, 0];
		for (let bit4 = 0; bit4 < 32; bit4++) {
			if (bit4 < inlinePrefix) {
				maskArray[Math.floor(bit4 / 8)] |= (1 << (7 - (bit4 % 8)));
			}
		}
		inputMask = maskArray.join('.');
	}

	if (inputMask === 'cidr' && !hasInlineCidr) {
		inputMask = OPENVPN.IPv4.MASK24;
	}

	if (!raw_mask && !hasInlineCidr) {
		// Strict baseline extraction: Returns pure clean NET IP block without trailing slash
		return calculateNetId(inputIp, inputMask);
	} else {
		// Return full clean NET IP paired with its calculated CIDR prefix
		const cleanNet = calculateNetId(inputIp, inputMask);
		return getCidrNet(cleanNet, inputMask);
	}
};

/**
 * Parses the OpenVPN configuration text line by line to extract remote subnets and format them into correct CIDR notation using the netIPCIDR function.
 */
const parseRemoteSubnets = function (content, role, noCIDR) {
	if (!content) return null;
	const remoteSubnets = [];

	let lines
	if (Array.isArray(content)) {
		lines = content;
	} else {
		lines = content.split('\n');
	}

	if (role === OPENVPN.ROLE.SERVER) {

		for (let i = 0; i < lines.length; i++) {
			// Trim leading/trailing spaces and skip empty or commented out lines
			const line = lines[i].trim();
			if (line === '' || line.indexOf('#') === 0 || line.indexOf(';') === 0) continue;

			// Match "route <ip> <mask>" or "route <ip/prefix>"
			if (line.indexOf('route ') === 0) {
				const parts = line.split(/\s+/); // Splits by any consecutive spaces
				if (parts.length >= 2) {
					const foundIp = parts[1];
					let foundMask = '';

					// If it is IPv4 with a separate subnet mask (e.g., "route 192.168.10.0 255.255.255.0")
					if (parts.length >= 3 && !foundIp.includes('/') && !foundIp.includes(':')) {
						foundMask = parts[2];
					}
					// Convert to correct CIDR format and push to array safely if not duplicate
					let foundSubnet;
					if (noCIDR === true) {
						foundSubnet = netIPCIDR(foundIp, null);
					} else {
						foundSubnet = netIPCIDR(foundIp, foundMask);
					}
					if (foundSubnet && !remoteSubnets.includes(foundSubnet)) {
						remoteSubnets.push(foundSubnet);
					}
				}
			}
		}
	}
	else if (role === OPENVPN.ROLE.CLIENT) {

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i].trim();
			if (line === '' || line.indexOf('#') === 0 || line.indexOf(';') === 0) continue;

			// Match "setenv remotelan <ip> <mask>" or "setenv remotelan <ip/prefix>"
			if (line.indexOf('setenv remotelan ') === 0) {
				const parts = line.split(/\s+/);
				if (parts.length >= 3) {
					const foundIp = parts[2];
					let foundMask = '';

					// If it is IPv4 with a separate subnet mask (e.g., "setenv remotelan 192.168.20.0 255.255.255.0")
					if (parts.length >= 4 && !foundIp.includes('/') && !foundIp.includes(':')) {
						foundMask = parts[3];
					}
					let foundSubnet;
					if (noCIDR === true) {
						foundSubnet = netIPCIDR(foundIp, null);
					} else {
						foundSubnet = netIPCIDR(foundIp, foundMask);
					}

					if (foundSubnet && !remoteSubnets.includes(foundSubnet)) {
						remoteSubnets.push(foundSubnet);
					}
				}
			}
		}
	}
	return remoteSubnets;
};

/**
 * Safe parser to get ONLY the active status refresh seconds from the configuration file text
 */
const parseClientRefresh = function (content, instNum) {
	if (!content) {
		return 5;
	}

	// Example: status /tmp/run/openvpn.instance1.status 5

	// Match line starting with status, path, instance filename, space, and digits
	const patternStr = '^status\\s+\\S+openvpn\\.instance' + instNum + '\\.status\\s+(\\d+)(?:\\s|$)';
	const refreshRegex = new RegExp(patternStr, 'm');
	const refreshMatch = content.match(refreshRegex);

	if (refreshMatch && refreshMatch[1]) {
		return parseInt(refreshMatch[1], 10) || 5;
	}

	return 5;
};

/**
 * Check if site-to-site configuration is explicitly turned on
 */
const parseSiteToSite = function (content) {
	const sitetosite_regex = /^[ \t]*setenv\s+sitetosite\s+on/mi;
	return sitetosite_regex.test(content);
}

const parseSmartFirewall = function (content) {
	const sitetosite_regex = /^[ \t]*setenv\s+ovpnfirewall\s+on/mi;
	return sitetosite_regex.test(content);
}

/**
 * Trigger ovpnPending state for 5 seconds
 */
const ovpnPending = {
	isPending: false,

	// Activates the pending state. Stays permanent if the session is dead.
	trigger: function () {
		// 1. Abort immediately if the session expired (Autologout happened)
		if (typeof L.session === 'object' && typeof L.session.isAlive === 'function') {
			if (!L.session.isAlive()) {
				this.isPending = true;
				return;
			}
		}
		// 2. Activates the pending state and automatically clears it after 5 seconds
		if (this.isPending === false) {
			this.isPending = true;
			const self = this;
			setTimeout(function () {
				self.isPending = false;
			}, 5000);
		}
	}
};

/**
 * Parses the raw list of LuCI modifications to find changed instances
 */
const getPendingInstances = function (ovpnChanges) {
	const pendingInstances = [];
	if (!Array.isArray(ovpnChanges)) return pendingInstances;

	for (let i = 0; i < ovpnChanges.length; i++) {
		const change = ovpnChanges[i];
		if (Array.isArray(change) && change.length >= 3) {
			const operation = change[0];
			const sectionName = change[1];
			const optionName = change[2];

			if (operation === 'set' && optionName === 'enabled' && sectionName) {
				if (pendingInstances.indexOf(sectionName) === -1) {
					pendingInstances.push(sectionName);
				}
			}
		}
	}
	return pendingInstances;
};

/**
 * Checks the overall running state of all OpenVPN profiles together
 */
const getCurrentOvpnState = function (ovpnUciSections, updatedInstances, pendingInstances) {
	const uciEnabled = isAnyInstanceEnabled(ovpnUciSections);
	if (!uciEnabled) {
		return OPENVPN.STATE.disabled;
	}

	// First check if pending state
	if (ovpnPending.isPending === true) {
		return OPENVPN.STATE.pending;
	}
	if (Array.isArray(pendingInstances) && pendingInstances.length > 0) {
		return OPENVPN.STATE.pending;
	}
	// If the updatedInstances array from ubus is missing or empty during a refresh drop, return 'pending'
	if (!updatedInstances || updatedInstances.length === 0) {
		return OPENVPN.STATE.pending;
	}

	let totalEnabledCount = 0;
	let totalRunningCount = 0;

	for (let i = 0; i < updatedInstances.length; i++) {
		const inst = updatedInstances[i];
		if (inst && isInstanceEnabled(inst.id)) {
			totalEnabledCount++;
			if (inst.isRunning === true) {
				totalRunningCount++;
			}
		}
	}

	if (totalEnabledCount > 0 && totalRunningCount === totalEnabledCount) {
		return OPENVPN.STATE.active;
	}

	// Returns error ONLY if an enabled instance is genuinely dead after a solid live read
	return OPENVPN.STATE.error;
};

/**
 * Safe parser to get the numeric instance index from a string ID.
 */
const getInstanceNumber = function (instance_id, default_number) {
	if (!default_number) {
		default_number = 1;
	} else {
		const fallbackNum = (typeof default_number === 'number') ? default_number : parseInt(default_number, 10);
		const safeFallback = !isNaN(fallbackNum) ? fallbackNum : 1;
		default_number = safeFallback;
	}
	if (typeof instance_id !== 'string' || !instance_id) {
		return default_number;
	}
	const numMatch = instance_id.match(/\d+$/);
	if (numMatch) {
		const parsedNum = parseInt(numMatch[0], 10);
		return !isNaN(parsedNum) ? parsedNum : default_number;
	}
	return default_number;
};

/**
 * Compiles or load from cache the compiled INSTANCE_TEMPLATE configuration
 */
const getInstanceConfig = async function (id, instNum, role, path_conf) {
	let currentMtimeConf = 0;
	let currentSizeConf = 0;

	try {
		const confStat = await rpcStatFile(path_conf);
		if (confStat) {
			if (typeof confStat.mtime === 'object' && confStat.mtime.sec) {
				currentMtimeConf = parseInt(confStat.mtime.sec, 10) || 0;
			} else if (typeof confStat.mtime === 'number') {
				currentMtimeConf = Math.floor(confStat.mtime);
			}
			currentSizeConf = parseInt(confStat.size, 10) || 0;

			// Cache HIT path
			if (configAssetCache[id] &&
				configAssetCache[id].mtime === currentMtimeConf &&
				configAssetCache[id].size === currentSizeConf) {
				return Object.assign({}, configAssetCache[id].cachedBase);
			}
		}
	} catch {
		// Proceed to live compilation on error
	}

	let confContent = sanitizeInputText(await rpcReadFile(path_conf));
	if (confContent.length === 0) {
		// Signals readSingleInstanceStatus to execute early exit template
		return null;
	}
	const lines = confContent.split('\n');
	const devName = getDevName(id, instNum, false);

	const detectedDdnsTarget = parseDdnsFromConfig(confContent);
	const inst = Object.assign({}, INSTANCE_TEMPLATE, {
		id: id,
		instNum: instNum,
		devName: devName,
		role: role,
		ddns: detectedDdnsTarget,
		confContent: confContent,
		connectedClients: []
	});

	let currentPort = parsePortFromConfig(role, lines);
	if (!currentPort || isNaN(currentPort)) {
		currentPort = calcPortFromId(id, instNum);
	}
	inst.port = currentPort;

	const portExternMatch = inst.confContent.match(/^setenv\s+portextern\s+(\d+)/m);
	inst.portExtern = portExternMatch ? parseInt(portExternMatch[1], 10) : currentPort;
	inst.proto = parseProtoFromConfig(lines);
	inst.clientRefresh = parseClientRefresh(inst.confContent, instNum);


	if (role === OPENVPN.ROLE.SERVER) {
		inst.smartFirewall = parseSmartFirewall(inst.confContent);
		inst.serverSiteToSite = parseSiteToSite(inst.confContent);
	}
	if ((inst.serverSiteToSite || role === OPENVPN.ROLE.CLIENT)) {
		inst.remoteSubnets = parseRemoteSubnets(lines, role, false);
	}


	// // check uci
	// const uciSmartFirewall = L.uci.get(CFG.CMD.openvpn, id, CFG.CMD.ovpnfirewall) === '1';
	// if (inst.smartFirewall != uciSmartFirewall) {
	// 	if (inst.smartFirewall === true) {
	// 		await uciSetBackground(CFG.CMD.openvpn, id, CFG.CMD.ovpnfirewall, '1');
	// 	} else {
	// 		await uciDelBackground(CFG.CMD.openvpn, id, CFG.CMD.ovpnfirewall);
	// 	}
	// }
	// const uciSiteToSite = L.uci.get(CFG.CMD.openvpn, id, CFG.CMD.sitetosite) == '1';
	// if (inst.serverSiteToSite != uciSiteToSite) {
	// 	if (inst.smartFirewall === true) {
	// 		await uciSetBackground(CFG.CMD.openvpn, id, CFG.CMD.sitetosite, '1');
	// 	} else {
	// 		await uciDelBackground(CFG.CMD.openvpn, id, CFG.CMD.sitetosite);
	// 	}
	// }

	inst.useLogFilter = inst.confContent.match(/setenv\s+logfilter\s+on/i) ? true : false;

	for (var i = 0; i < lines.length; i++) {
		var cleanLine = lines[i].trim();

		if (cleanLine.indexOf('cipher ') === 0) {
			inst.cipher = cleanLine.replace('cipher ', '').trim().toUpperCase();
		} else if (cleanLine.indexOf('data-ciphers ') === 0) {
			var dcParts = cleanLine.replace('data-ciphers ', '').trim().split(':');
			if (dcParts && dcParts[0]) {
				inst.cipher = dcParts[0].trim().toUpperCase();
			}
		}

		if (role === OPENVPN.ROLE.CLIENT && cleanLine.indexOf('remote ') === 0) {
			var rParts = cleanLine.split(/\s+/);
			var remoteIp = (rParts.length >= 2) ? rParts[1] : OPENVPN.IPv4.LOOPBACK;
			var remotePort = (rParts.length >= 3) ? rParts[2] : OPENVPN.PORT.s1194;
			inst.localIp = OPENVPN.IPv4.LOOPBACK;
			inst.remoteClient = remoteIp + ':' + remotePort;
		} else if (role === OPENVPN.ROLE.SERVER) {
			if (cleanLine.indexOf('server ') === 0) {
				var sParts = cleanLine.split(/\s+/);
				if (sParts.length >= 2) inst.localIp = sParts[1].replace(/\.0$/, '.1');
			}
		}
	}

	if (currentMtimeConf > 0) {
		configAssetCache[id] = {
			mtime: currentMtimeConf,
			size: currentSizeConf,
			cachedBase: Object.assign({}, inst)
		};
	}

	return inst;
};

/**
 * Measures the process start uptime using the Linux /proc framework securely
 */
const getProcessStartTime = async function (id, pidVal, currentUptime) {
	try {
		// Read the file status metadata of the process folder inside the proc filesystem
		const statObj = await rpcStatFile('/proc/' + pidVal);

		if (statObj && statObj.mtime) {
			let rawMtimeSec = 0;

			// Extract the modification timestamp depending on the variable data type
			if (typeof statObj.mtime === 'object' && statObj.mtime.sec) {
				rawMtimeSec = parseInt(statObj.mtime.sec, 10) || 0;
			} else if (typeof statObj.mtime === 'number') {
				rawMtimeSec = Math.floor(statObj.mtime);
			} else if (typeof statObj.mtime === 'string') {
				rawMtimeSec = parseInt(statObj.mtime, 10) || 0;
			}

			// CASE 1: The system works with simple uptime seconds (small timestamp under 1 billion)
			if (rawMtimeSec < 1000000000) {
				return Math.max(1, Math.floor(rawMtimeSec));
			}

			// CASE 2: The system uses real-world dates (large timestamp)
			// Get the current real UNIX time from the browser/system clock
			const currentUnixTime = Math.floor(new Date().getTime() / 1000);
			const secondsAgo = currentUnixTime - rawMtimeSec;

			// Check if the calculated time makes sense within the current router uptime
			// The process cannot be older than the router uptime and cannot be from the future
			if (secondsAgo >= 0 && secondsAgo <= currentUptime) {
				return Math.max(1, Math.floor(currentUptime - secondsAgo));
			}

			// CASE 3: Fallback for NTP clock jumps or time sync shifts
			// If the time is invalid, the process started early during the boot phase.
			// We return 5 seconds after boot to keep the dashboard stable.
			return 5;
		}
	} catch {
		// Silent catch
	}
	return 0;
};


/**
 * Read the connected client status file if necessary or use the statusFileCache
 */
const getConnectedClientsStatus = async function (inst) {
	try {
		const statusFilePath = '/tmp/run/openvpn.' + inst.id + '.status';
		const fileStat = await rpcStatFile(statusFilePath);

		const maxAllowedFileAge = inst.clientRefresh * 5;

		if (fileStat) {
			let currentMtime = 0;
			if (typeof fileStat.mtime === 'object' && fileStat.mtime.sec) {
				currentMtime = parseInt(fileStat.mtime.sec, 10) || 0;
			} else if (typeof fileStat.mtime === 'number') {
				currentMtime = Math.floor(fileStat.mtime);
			}
			const currentSize = parseInt(fileStat.size, 10) || 0;

			if (!statusFileCache[inst.id]) {
				statusFileCache[inst.id] = { mtime: 0, size: 0, parsedClients: [] };
			}

			const currentRouterUnixTime = Math.floor(new Date().getTime() / 1000);
			const fileAgeSeconds = Math.abs(currentRouterUnixTime - currentMtime);

			// Invalidate cache immediately if openvpn daemon froze in deadlock
			if (fileAgeSeconds > maxAllowedFileAge) {
				statusFileCache[inst.id].parsedClients = [];
				return [];
			}

			// use cache if no change
			if (statusFileCache[inst.id].mtime === currentMtime &&
				statusFileCache[inst.id].size === currentSize) {
				return statusFileCache[inst.id].parsedClients;
			}

			// change detected - parse status file
			const statusContent = await luci_app_openvpn_plus([CFG.LIBEXEC.readstatus, inst.id]);

			if (statusContent.length > 0) {
				const freshClients = parseConnectedClients(statusContent, inst);

				statusFileCache[inst.id].mtime = currentMtime;
				statusFileCache[inst.id].size = currentSize;
				statusFileCache[inst.id].parsedClients = freshClients;

				return freshClients;
			}
		}
	} catch {
		// Silent catch fallback execution
	}

	if (statusFileCache[inst.id]) {
		statusFileCache[inst.id].parsedClients = [];
	}
	return [];
};

/**
 * Reads the active runtime status and telemetry fields
 */
const readSingleInstanceStatus = async function (id, instancesObj, currentUptime) {
	const instNum = getInstanceNumber(id);
	const path_conf = CFG.FILE.dir_cfg + id + '.conf';
	const role = L.uci.get(CFG.CMD.openvpn, id, 'role') || OPENVPN.ROLE.SERVER;
	const devName = getDevName(id, instNum, false);

	// Step 1: Get instance configuration profile from file or cache
	let inst = await getInstanceConfig(id, instNum, role, path_conf);

	// Early exit if no instance configuration found
	if (inst === null) {
		return Object.assign({}, INSTANCE_TEMPLATE, {
			id: id,
			instNum: instNum,
			devName: devName,
			role: role,
			isRunning: false,
			pid: '-',
			connectedClients: []
		});
	}

	// Get process running state and pid from service list
	const runtimeInstance = instancesObj[id] || {};
	const isRunning = (runtimeInstance.running === true);
	const pidVal = isRunning ? (runtimeInstance.pid || '-') : '-';

	inst.isRunning = isRunning;
	inst.pid = pidVal;

	// Exit if the server daemon process is offline
	if (isRunning === false || pidVal === '-') {
		inst.startTime = 0;
		inst.connectedClients = [];
		return inst;
	}

	// Step 2: Measure dynamic runtime process uptime via proc stats
	inst.startTime = await getProcessStartTime(id, pidVal, currentUptime);

	// Step 3: Resolve connected users matrix buffer via cached shell routine
	inst.connectedClients = await getConnectedClientsStatus(inst);

	return inst;
};

/**
 * Reads the active runtime status and telemetry fields for all instances
 */
const readInstanceStatus = async function (ovpnUciSections, instancesObj, systemUptime) {
	try {
		const instPromises = [];
		const currentUptime = parseFloat(systemUptime) || 0;
		const ovpnSections = Array.isArray(ovpnUciSections) ? ovpnUciSections : [];

		// Modern, flat iterator to populate the background scanning registers
		for (const section of ovpnSections) {
			if (!section) continue;
			const id = section['.name'];

			// Push the independent worker promises into the central pipeline array container
			instPromises.push(readSingleInstanceStatus(id, instancesObj, currentUptime));
		}
		// Fire all configuration scans simultaneously in parallel for rapid modal loads
		return await Promise.all(instPromises);
	}
	catch {
		return null;
	}
};


/*
 * --- STATUS VIEW ---
 */


/**
 * Renders the remote node network column context based on instance roles
 */
const renderRemoteNode = function (role, isRunning, connectedClients, protoStr, netstat) {
	if (!isRunning) {
		return E('span', { 'style': 'color:color-mix(in srgb, var(--text-color-medium, #71717a) 85%, #0055ff);' }, '-');
	}
	if (!Array.isArray(connectedClients) || connectedClients.length === 0) {
		const no_connencted = (role === OPENVPN.ROLE.CLIENT) ? TXT.INFO.no_server_connected : TXT.INFO.no_clients_connected;
		return E('span', { 'style': 'font-style: italic; color:color-mix(in srgb, var(--text-color-medium, #71717a) 85%, #0055ff);' }, no_connencted);
	}

	const remoteName = (role === OPENVPN.ROLE.CLIENT) ? TXT.INFO.server : TXT.INFO.client;
	const clientRows = [];

	connectedClients.forEach(function (client) {
		const rawAddress = client.realAddress || '';
		let displayAddress = rawAddress;
		let currentProto = protoStr;

		// Check if address contains a colon (like udp4:192.168.1.1:51820)
		if (rawAddress.indexOf(':') !== -1) {
			const parts = rawAddress.split(':');
			// Get the first part and convert to lowercase for the check
			const firstPart = parts[0].toLowerCase();
			// If first part is a protocol prefix, process and clean it
			if (firstPart.indexOf(OPENVPN.PROTO.UDP) === 0 || firstPart.indexOf(OPENVPN.PROTO.TCP) === 0) {
				// Remove everything after the dash (e.g. "tcp4-server" becomes "tcp4")
				currentProto = firstPart.split('-')[0];
				displayAddress = parts.slice(1).join(':'); // Keep only IP and port
			}
		}

		clientRows.push(E('div', {
			'style': 'font-family: var(--font-monospace, monospace); margin: 0; padding: 0; border: none !important; line-height: 1.3;'
		}, [
			E('strong', {}, [
				E('span', { 'style': 'color: var(--primary-color-high, #3b82f6);' }, displayAddress),
				E('span', { 'style': 'color:color-mix(in srgb, var(--text-color-medium, #71717a) 85%, #0055ff); font-weight: normal' }, '/' + currentProto)
			]),
			E('small', {
				'style': 'display: block; font-size: 11px; color:color-mix(in srgb, var(--text-color-medium, #71717a) 85%, #0055ff); margin-top: 0px;'
			}, [
				remoteName + ': ',
				E('strong', { 'style': 'color: var(--success-color-high, #10b981); font-weight: bold;' }, client.commonName)
			]),
			E('small', {
				'style': 'display: block; font-size: 11px; color:color-mix(in srgb, var(--text-color-medium, #71717a) 85%, #0055ff); margin-top: 0px;'
			}, TXT.INFO.since + ': ' + client.connectedSince),
			E('small', {
				'style': 'display: block; font-size: 11px; color:color-mix(in srgb, var(--text-color-medium, #71717a) 85%, #0055ff); margin-top: 0px;'
			}, TXT.INFO.session + ': ' + formatStatusBytes(client.bytesReceived) + ' / ' + formatStatusBytes(client.bytesSent))
		]));

	});

	return E('div', { 'style': 'display: block; margin: 0; padding: 0; border: none !important;' }, clientRows);
};

/**
 * Formats a raw byte count into a standard OpenWRT binary data size string (B, KiB, MiB, GiB, or TiB)
 */
const formatStatusBytes = function (b) {
	if (b >= 1099511627776) {
		return (b / 1099511627776).toFixed(2) + ' TiB';
	}
	if (b >= 1073741824) {
		return (b / 1073741824).toFixed(2) + ' GiB';
	}
	if (b >= 1048576) {
		return (b / 1048576).toFixed(2) + ' MiB';
	}
	if (b >= 1024) {
		return (b / 1024).toFixed(2) + ' KiB';
	}
	// Return as a whole number because fractions of bytes do not exist
	return parseInt(b, 10) + ' B';
};

/**
 * Calculates and formats individual tunnel runtime durations using system uptime seconds
 */
const calculateInstanceUptime = function (procStartSeconds, systemUptime) {
	const startSec = parseInt(procStartSeconds, 10);
	if (isNaN(startSec) || startSec <= 0) return '-';

	const diff = Math.floor(systemUptime) - startSec;
	if (isNaN(diff) || diff < 0) return '0h 0m 0s';

	const days = Math.floor(diff / 86400);
	const hours = Math.floor((diff % 86400) / 3600);
	const minutes = Math.floor((diff % 3600) / 60);
	const seconds = diff % 60;

	if (days > 0) {
		return days + 'd ' + hours + 'h ' + minutes + 'm ' + seconds + 's';
	}
	return hours + 'h ' + minutes + 'm ' + seconds + 's';
};

/**
 * Get the openvpn instance status and telemetry table
 */
const getStatusTable = function (instances, systemUptime, isLiveRefresh, pendingInstances) {
	const tableRows = [];

	for (let i = 0; i < instances.length; i++) {
		const inst = instances[i];
		const role = inst.role || OPENVPN.ROLE.SERVER;

		const netstat = inst.netstat || { rxBytes: 0, rxPkts: 0, txBytes: 0, txPkts: 0, hasData: false };

		const protoStr = (inst.isRunning && inst.proto) ? inst.proto : '';
		const remoteIpNode = renderRemoteNode(role, inst.isRunning, inst.connectedClients, protoStr, netstat);

		const customUciName = L.uci.get(CFG.CMD.openvpn, inst.id, 'displayname') || '';
		const displayId = customUciName ? customUciName : TXT.INFO.instance_x + inst.instNum;

		// Create the instance type badge (Server / Client)
		const typeBadge = E('span', {
			'class': 'ifacebadge',
			'style': 'font-weight:normal !important; padding:2px 6px; border-radius:3px; background:var(--background-color, transparent) !important; border:1px solid var(--border-color-medium, #cbd5e1);'
		}, role.charAt(0).toUpperCase() + role.slice(1));

		const isPending = (Array.isArray(pendingInstances) && pendingInstances.indexOf(inst.id) !== -1);
		let statusBadge;

		// Select the correct status badge style based on the runtime state
		if (isPending) {
			statusBadge = E('span', {
				'class': 'ifacebadge',
				'style': 'font-weight:normal !important; padding:2px 8px; border-radius:3px; background:color-mix(in srgb, var(--warn-color-high, #eab308) 12%, transparent) !important; color: var(--warn-color-high, #eab308) !important; border:1px solid var(--warn-color-high, #eab308); text-shadow:none !important; box-shadow:none !important;'
			}, TXT.INFO.pending);
		} else if (inst.isRunning) {
			statusBadge = E('span', {
				'class': 'ifacebadge',
				'style': 'font-weight:normal !important; padding:2px 8px; border-radius:3px; background:color-mix(in srgb, var(--primary-color-high, #3b82f6) 12%, transparent) !important; color:var(--primary-color-high, #3b82f6) !important; border:1px solid var(--primary-color-high, #3b82f6); text-shadow:none !important; box-shadow:none !important;'
			}, TXT.INFO.running + ' (PID: ' + inst.pid + ')');
		} else if (L.uci.get(CFG.CMD.openvpn, inst.id, 'enabled') === '1') {
			if (!isLiveRefresh) {
				statusBadge = E('span', {
					'class': 'ifacebadge',
					'style': 'font-weight:normal !important; padding:2px 8px; border-radius:3px; background:color-mix(in srgb, var(--warn-color-high, #eab308) 12%, transparent) !important; color: var(--warn-color-high, #eab308) !important; border:1px solid var(--warn-color-high, #eab308); text-shadow:none !important; box-shadow:none !important;'
				}, TXT.INFO.creating);
			} else {
				statusBadge = E('span', {
					'class': 'ifacebadge',
					'style': 'font-weight:normal !important; padding:2px 8px; border-radius:3px; background:color-mix(in srgb, var(--error-color-high, #ef4444) 12%, transparent) !important; color: var(--error-color-high, #ef4444) !important; border:1px solid var(--error-color-high, #ef4444); text-shadow:none !important; box-shadow:none !important;'
				}, TXT.INFO.error);
			}
		} else {
			statusBadge = E('span', {
				'class': 'ifacebadge',
				'style': 'font-weight:normal !important; padding:2px 8px; border-radius:3px; background:var(--background-color-medium, #f4f4f5) !important; color:color-mix(in srgb, var(--text-color-medium, #71717a) 85%, #0055ff) !important; border:1px solid var(--border-color-medium, #cbd5e1); text-shadow:none !important; box-shadow:none !important;'
			}, TXT.INFO.disabled);
		}


		let localConnectionNode = '-';
		if (inst.isRunning) {
			const activePort = inst.port || '?';
			const activeProto = inst.proto ? '/' + inst.proto.toLowerCase() : '';

			localConnectionNode = E('span', {
				'style': 'font-family:var(--font-monospace, monospace);'
			}, [
				inst.localIp + ':' + activePort,
				E('span', { 'style': 'color:color-mix(in srgb, var(--text-color-medium, #71717a) 85%, #0055ff);' }, activeProto)
			]);
		}

		// Clean separation between primary Data Bytes and volatile Packet Counters
		let transferNode = '-';
		if (inst.isRunning && netstat.hasData) {
			transferNode = E('div', {
				'style': 'font-family:var(--font-monospace, monospace); line-height:1.4; white-space:nowrap; padding:0; margin:0;'
			}, [
				E('div', { 'style': 'white-space:nowrap;' }, [
					'▲ ', formatStatusBytes(netstat.txBytes),
					E('small', { 'style': 'font-size:11px; color:color-mix(in srgb, var(--text-color-medium, #71717a) 85%, #0055ff); margin-left:4px;' }, '(' + netstat.txPkts + ' pkt)')
				]),
				E('div', { 'style': 'white-space:nowrap; margin-top:1px;' }, [
					'▼ ', formatStatusBytes(netstat.rxBytes),
					E('small', { 'style': 'font-size:11px; color:color-mix(in srgb, var(--text-color-medium, #71717a) 85%, #0055ff); margin-left:4px;' }, '(' + netstat.rxPkts + ' pkt)')
				])
			]);
		} else if (inst.isRunning) {
			transferNode = E('div', {
				'style': 'font-family:var(--font-monospace, monospace);'
			}, [
				E('span', {}, '-'),
			]);
		}

		const uptimeDisplay = calculateInstanceUptime(inst.startTime, systemUptime);
		const cipherLabel = String(inst.cipher || 'AES-256-GCM');

		// Create alternate row styling classes for visual structure
		const rowStyleClass = (i % 2 === 0) ? 'tr cbi-section-table-row cbi-rowstyle-1' : 'tr cbi-section-table-row cbi-rowstyle-2';

		// Push the complete generated row node array into the table loop memory
		tableRows.push(E('tr', { 'class': rowStyleClass }, [
			E('td', { 'class': 'td' }, '#' + inst.instNum),
			E('td', { 'class': 'td', 'style': 'font-weight:bold;' }, displayId),
			E('td', { 'class': 'td' }, typeBadge),
			E('td', { 'class': 'td' }, statusBadge),
			E('td', { 'class': 'td' }, localConnectionNode),
			E('td', { 'class': 'td' }, remoteIpNode),
			E('td', { 'class': 'td', 'style': 'font-family:var(--font-monospace, monospace); font-weight:bold; color: var(--success-color-high, #10b981);' }, inst.isRunning ? cipherLabel : '-'),
			E('td', { 'class': 'td' }, transferNode),
			E('td', { 'class': 'td', 'style': 'font-family:var(--font-monospace, monospace);' }, inst.isRunning ? uptimeDisplay : '-')
		]));

	}

	let statusTableRows;
	if (tableRows.length > 0) {
		statusTableRows = tableRows;
	} else {
		statusTableRows = [E('tr', { 'class': 'tr' }, [
			E('td', { 'class': 'td', 'colspan': '9', 'style': 'text-align:center; font-style:italic; color:color-mix(in srgb, var(--text-color-medium, #71717a) 85%, #0055ff);' }, TXT.INFO.no_inst)])
		]
	}

	// Create the status table
	const statusTable = E('table', { 'class': 'table cbi-section-table' }, [
		E('tr', { 'class': 'tr cbi-section-table-titles' }, [
			E('th', { 'class': 'th' }, TXT.INFO.vpn),
			E('th', { 'class': 'th' }, TXT.INFO.instance),
			E('th', { 'class': 'th' }, TXT.INFO.type),
			E('th', { 'class': 'th' }, TXT.INFO.status),
			E('th', { 'class': 'th' }, TXT.INFO.local_ip_port),
			E('th', { 'class': 'th' }, TXT.INFO.remote_ip_port),
			E('th', { 'class': 'th' }, TXT.INFO.encryption),
			E('th', { 'class': 'th' }, TXT.INFO.transfer),
			E('th', { 'class': 'th' }, TXT.INFO.uptime)
		])
	].concat(statusTableRows));
	return statusTable;
};

/**
 * Calculates aggregated traffic statistics from all running instances
 */
const calculateTunnelTraffic = function (instances) {
	const traffic = { rx: 0, tx: 0 };

	// Check if the input is a valid array with data
	if (!Array.isArray(instances) || instances.length === 0) {
		return traffic;
	}

	// Loop through all instances and sum up the data
	for (let i = 0; i < instances.length; i++) {
		const inst = instances[i];

		// Only add the bytes if the netstat object has active data
		if (inst && inst.isRunning && inst.netstat && inst.netstat.hasData) {
			traffic.rx += inst.netstat.rxBytes;
			traffic.tx += inst.netstat.txBytes;
		}
	}

	return traffic;
};

/**
 * Get status tooltip
 */
const getTooltipNode = function (ovpnState, appData) {

	const totalInstances = appData.instances.length;
	const instances = appData.instances;

	let runningInstances = 0;
	const activePids = [];

	for (let i = 0; i < instances.length; i++) {
		if (instances[i].isRunning) {
			runningInstances++;
			if (instances[i].pid && instances[i].pid !== '-') {
				activePids.push(instances[i].pid);
			}
		}
	}

	const textState = (ovpnState !== OPENVPN.STATE.disabled) ? TXT.INFO.yes : TXT.INFO.no;
	const imageState = (ovpnState !== OPENVPN.STATE.disabled) ? CFG.FILE.vpn_enabled_img : CFG.FILE.vpn_disabled_img;
	const textContented = runningInstances + '/' + totalInstances;
	const textPids = (activePids.length > 0) ? activePids.join(', ') : '-';
	const traffic = calculateTunnelTraffic(instances);
	const textRx = formatStatusBytes(traffic.rx);
	const textTx = formatStatusBytes(traffic.tx);

	let versionTooltip = [];
	if (openVpnInfo.version) {
		versionTooltip.push(E('span', { 'class': 'nowrap' }, [E('strong', {}, 'OpenVPN: '), 'v.' + openVpnInfo.version]));
		versionTooltip.push(E('br'));
	}
	if (openVpnInfo.openssl) {
		versionTooltip.push(E('span', { 'class': 'nowrap' }, [E('strong', {}, openVpnInfo.openssl_type + ': '), 'v.' + openVpnInfo.openssl]));
		versionTooltip.push(E('br'));
	}
	if (openVpnInfo.dco) {
		versionTooltip.push(E('span', { 'class': 'nowrap' }, [E('strong', {}, 'Data Channel Offload: '), 'v.' + openVpnInfo.dco]));
		versionTooltip.push(E('br'));
	}

	// Build the status summary tooltip
	const tooltipNode = E('span', { 'class': 'cbi-tooltip ifacebadge large', 'style': 'text-align:left; font-weight:normal;' }, [
		E('img', { 'src': imageState, 'style': 'float:left; margin-right:10px; width:24px; height:24px;' }),
		E('span', { 'class': 'left', 'style': 'display:block; overflow:hidden; font-size:0.8em;' }, [
			E('span', { 'class': 'nowrap' }, [E('strong', {}, TXT.INFO.enabled + ': '), textState]), E('br'),
			E('span', { 'class': 'nowrap' }, [E('strong', {}, TXT.INFO.instances + ': '), String(totalInstances)]), E('br'),
			E('span', { 'class': 'nowrap' }, [E('strong', {}, TXT.INFO.connected + ': '), textContented]), E('br'),
			E('span', { 'class': 'nowrap' }, [E('strong', {}, TXT.INFO.active_pids + ': '), textPids]), E('br'),
			E('span', { 'class': 'nowrap' }, [E('strong', {}, TXT.INFO.aggregated_rx + ': '), textRx]), E('br'),
			E('span', { 'class': 'nowrap' }, [E('strong', {}, TXT.INFO.aggregated_tx + ': '), textTx]), E('br'),
			E('br')
		].concat(versionTooltip))
	]);

	return tooltipNode
}

/**
 * Refreshes the status table and updates the main dashboard view continuously.
 */
const refreshLiveDashboard = async function (appData, tableContainerElement, refreshStatusBoxCallback) {
	try {
		// 2. Fetch service data and uci changes simultaneously
		const results = await Promise.all([
			rpcGetServiceStatus(),
			L.uci.changes(),
			getSystemUptime()
		]);

		const serviceData = results[0];
		const uciChanges = results[1];
		const systemUptime = results[2];
		appData.uptime = systemUptime;

		// Check A: If ubus blocked the query (Session Timeout / Tab Sleep), abort instantly! Do NOT overwrite appData with corrupt empty elements.
		if (!serviceData || typeof serviceData !== 'object') {
			return;
		}

		const instancesObj = serviceData.instances || {};
		const ovpnChanges = (uciChanges && uciChanges[CFG.CMD.openvpn]) ? uciChanges[CFG.CMD.openvpn] : null;
		const pendingInstances = getPendingInstances(ovpnChanges);

		// 3. Wait for the instance status data safely
		const updatedInstances = await readInstanceStatus(appData.ovpnUciSections, instancesObj, systemUptime);

		// Check B: Structural integrity check. If the array dropped to zero but UCI has profiles, a background processing block occurred -> Abort!
		if ((!updatedInstances || updatedInstances.length === 0) && appData.ovpnUciSections && appData.ovpnUciSections.length > 0) {
			return;
		}

		// refresh netstat in the instances (e.g. /sys/class/net/tun0/statistics)
		await refreshNetStat(updatedInstances);

		// Save the fresh verified data into the global cache object safely
		appData.instances = updatedInstances;

		// 4. Update the live status table layout on the screen
		if (tableContainerElement && tableContainerElement.firstChild) {
			const freshTableNode = getStatusTable(appData.instances, systemUptime, true, pendingInstances);
			tableContainerElement.replaceChild(freshTableNode, tableContainerElement.firstChild);
		}

		// 5. Fire the callback method to update the main view badges
		if (typeof refreshStatusBoxCallback === 'function') {
			const ovpnState = getCurrentOvpnState(appData.ovpnUciSections, appData.instances, pendingInstances);
			const tooltip = getTooltipNode(ovpnState, appData);

			refreshStatusBoxCallback(ovpnState, tooltip, appData);
		}

	} catch (err) {
		console.error('LuCI Live Dashboard Refresh Failed:', err.message);
	}
};

/**
 * Hardware initializer executed on system class load
 */
const onLoad = async function () {
	try {

		// Register a global listener for LuCI RPC errors (Autologout tracking)
		document.addEventListener('luci-request-error', function (ev) {
			// Set pending if the error status indicates an expired session (403 Forbidden or 6)
			if (ev && ev.detail && (ev.detail.status === 403 || ev.detail.code === 6)) {
				ovpnPending.trigger();
			}
		});

		await getOpenVpnInfo();

	} catch {
		// silent catch
	}
};

/**
 * Export the status functions to the main LuCI view layer
 */
return L.Class.extend({
	INSTANCE_TEMPLATE: INSTANCE_TEMPLATE,
	CLIENT_TEMPLATE: CLIENT_TEMPLATE,
	onLoad: onLoad,
	getDevName: getDevName,
	getInstanceNumber: getInstanceNumber,
	calcPortFromId: calcPortFromId,
	parseSiteToSite: parseSiteToSite,
	parseSmartFirewall: parseSmartFirewall,
	parsePortFromConfig: parsePortFromConfig,
	parseProtoFromConfig: parseProtoFromConfig,
	parseDdnsFromConfig: parseDdnsFromConfig,
	netIPCIDR: netIPCIDR,
	formatStatusBytes: formatStatusBytes,
	parseRemoteSubnets: parseRemoteSubnets,
	readInstanceStatus: readInstanceStatus,
	getTooltipNode: getTooltipNode,
	getStatusTable: getStatusTable,
	getSystemUptime: getSystemUptime,
	ovpnPending: ovpnPending,
	refreshNetStat: refreshNetStat,
	refreshLiveDashboard: refreshLiveDashboard
});

