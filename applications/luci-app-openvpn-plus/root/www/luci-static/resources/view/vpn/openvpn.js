/*
 * Copyright (C) 2008-2026 The OpenWrt Project
 * Copyright (C) 2026 Manfred Jaider <info@masmbit.com>
 *
 * This is free software, licensed under the Apache License, Version 2.0.
 * See /LICENSE for more information.
 *
 * luci-app-openvpn-plus : user interface for easy OpenVPN server and client configuration
 * /www/luci-static/resources/view/vpn/openvpn.js
 *
 * 1. --- TEXT & DEFINITIONS --- ....Global translations and system definitions
 * 2. --- HELPER & INIT --- ........ Router connections and file setup
 * 3. --- SAVE AND RESTART --- ..... UCI saving and instance restart logic
 * 4. --- OVPN PROFILES --- ........ Import and export .ovpn profiles
 * 5. --- STATUS VIEW --- .......... Main OpenVPN dashboard
 * 6. --- OPENVPN INSTANCES --- .... Instance settings and creation buttons
 * 7. --- FIREWALL & LOG VIEW --- .. Active ports info and system log box
 * 8. --- LOCK SCREEN --- .......... Startup loading overlay and pollers
 * 9. --- MAIN VIEW --- ............ Main entry where the page is generated
 */

/* global E, URL, FileReader, Blob, sessionStorage, uqr, network */
'use strict';
'require uqr';
'require network';

const view = L.view;

/*
 * --- TEXT & DEFINITIONS ---
 */
const TXT = {
	INFO: {
		active: _('Active'),
		clearing: _('Clearing...'),
		creating: _('Creating...'),
		disable: _('Disable'),
		disabled: _('Disabled'),
		export_profile: _('Export Profile'),
		enable: _('Enable'),
		error: _('Error'),
		instance_x: _('Instance #'),
		log_clear: _('Clear Log'),
		log_cleared: _('Log Cleared'),
		no: _('No'),
		no_changes_detected: _('No changes detected'),
		openvpn: _('OpenVPN'),
		pending: _('Pending...'),
		starting: _('Starting...'),
		status: _('Status'),
		title_instance: _('Instance Management'),
		title_log: _('LOG'),
		title_main: _('OpenVPN Server/Client'),
		netmask: _('Netmask'),
		remote_lan_subnet: _('Remote LAN Subnet'),
		remote_name: _('Remote Name'),
		wizard: _('Wizard'),
		yes: _('Yes')
	},
	BTN: {
		add_client: _('Add Client Instance'),
		add_server: _('Add Server Instance'),
		cancel: _('Cancel'),
		change: _('Change'),
		click_save_apply: _('Please click «Save & Apply».'),
		close: _('Close'),
		del_instance: _('Delete Instance'),
		del_ready: _('Deleted - Save & Apply'),
		download: _('Download'),
		download_ovpn: _('Download (.ovpn)'),
		enabled: _('Enabled'),
		generating: _('Generating...'),
		next: _('Next'),
		ok: _('OK'),
		processing: _('Processing...'),
		save_config: _('Save Config'),
		saving: _('Saving...'),
		saved: _('Saved'),
		show: _('Show'),
		upload: _('Upload'),
		use_fallback: _('Use Fallback')
	},
	MSG: {
		client_export: _('OpenVPN Client Export'),
		config_changed_reload: _('Configuration changed! Applying will temporarily restart the OpenVPN instance.'),
		confirm_del: _('Are you sure you want to delete '),
		download_only_available_window_open: _('Download and QR code link are only available while this window is open.'),
		edit_config: _('Edit Config file'),
		export_connection_address_qr_code: _('This is the address your VPN clients will use to connect from the internet. Scan the QR code with your phone camera or use the link below to download your connection profile.'),
		export_ovpn: _('Export (.ovpn)'),
		export_openvpn_connect_client_profile: _('Export OpenVPN Connect Client Profile'),
		import_ovpn: _('Import (.ovpn)'),
		import_openvpn_connect_client_profile: _('Import OpenVPN Connect Client Profile'),
		import_profile: _('Import Profile'),
		lan_to_lan_profile_selection: _('LAN-to-LAN Router Profile Selection'),
		manage_instance: _('Here you can manage multiple OpenVPN Server and Client instances dynamically.'),
		mobile_export: _('OpenVPN Connect Mobile Export'),
		no_active_log_entries: _('No active OpenVPN log entries found.'),
		no_vpn_configured: _('No OpenVPN instances configured yet. Use the Wizard to create new OpenVPN instances.'),
		no_vpn_log: _('No active OpenVPN log entries found.'),
		office_profile: _('Office Profile:'),
		placeholder_cn_mobile: _('e.g. my-smartphone'),
		please_assign_cn_name: _('Please assign a unique device name (Common Name) for this mobile profile:'),
		process_take_few_minutes: _('This automated initialization process can take a few minutes on your device...'),
		scan_qr_code_with_camera: _('Scan QR Code with Mobile Phone Camera:'),
		secure_temporary_profile_url: _('Secure Temporary Profile URL Field:'),
		select_remote_office_to_export: _('This server handles network rules for multiple remote offices. Please choose an existing office name or write a name to make a new connection profile.'),
		system_logs: _('System logs ...'),
		uploaded_file_invalid: _('Uploaded file is invalid or corrupt!'),
		vpn_client_address: _('VPN Client Connection Domain or Address:')
	},
	FIREWALL: {
		ACTIVE: _('ACTIVE'),
		auto_open_secure_connection: _(' are opened automatically for secure OpenVPN connections.'),
		automated_zone_setup: _('Automated Zone Setup: '),
		check_traffic_rules: _('Check Traffic Rules: '),
		devices_autocreated: _(' devices is created automatically.'),
		filtered: _('Filtered'),
		firewall: _('Firewall '),
		firewall_info: _('Firewall & Routing Information'),
		inbound_access: _('Inbound Access: '),
		network: _('Network '),
		openvpn_tunnel_interface: _('OpenVPN tunnel interfaces (tun0, tun1, tun3, etc.)'),
		packets: _('packets'),
		secure_firewall_for_all: _('A secure firewall zone for all '),
		smart_filewall: _('Smart Firewall'),
		smart_filewall_tooltip: _('Automatic port scans are a constant threat on the internet. The smart firewall detects, bans and drops these requests. This hides your system, prevents spying, saves CPU power and guarantees maximum VPN performance.'),
		protected_since: _('Protected since'),
		traffic_rules: _('Traffic Rules'),
		wan_ports: _('WAN ports '),
	},
	KEY: {
		ca: _('Certification Authority'),
		client_connection_needs_server_key_and_config: _('A client connection needs the server keys and config. Select an .ovpn profile to import them automatically, or click Cancel to use the default settings.'),
		create_key_new_office: _('Create keys for a new office...'),
		dh: _('Diffie - Hellman Parameters'),
		key_verification_failed: _('Key verification failed'),
		keygen: _('KeyGen'),
		keygen_in_progress: _('Key generation in progress...'),
		keygen_wait: _('Please wait while secure cryptographic, router-unique default assets are being generated.'),
		keyfile_not_exist: _('Key file is empty or does not exist on disk yet.'),
		openvpn_keys: _('OpenVPN Keys'),
		server_crt: _('Server Certificate'),
		server_key: _('Private Server Key'),
		client_crt: _('Client Certificate'),
		client_key: _('Private Client Key'),
		server_tls: _('TLS Crypt v2 Server Master Key'),
		client_tls: _('TLS Crypt v2 Client Key')
	},
	WARNING: {
		key_upload_nomatch: _('Warning: The uploaded file structure does not match the expected key type.'),
		key_upload_processing: _('Proceeding with invalid cryptographic keys will cause total connection failure and may lead to service instability or infinite daemon crash loops.'),
		key_upload_save_anyway: _('Do you want to proceed and save this file anyway?'),
		key_upload_title: _('Cryptographic Key Warning'),
		profile_link_without_qr_code: _('Profile link active (Native uqr framework (QR-Code) not loaded).'),
		security_notice: _('Security Notice:'),
		tls_missing: _('Import cancelled due to missing TLS-Crypt v2 protection.'),
		tls_security_warning: _('Security Warning!'),
		tls_not_in_profile: _('This profile does not use TLS-Crypt v2. It is highly recommended to use TLS-Crypt v2 for maximum security, better performance, and protection against unauthorized scanning.'),
		tls_proced_import_anyway: _('Do you want to proceed with the import anyway?')
	},
	ERROR: {
		build_profile: _('Failed to build profile: '),
		config_key_missing: _('Error: Configuration or cryptographic keys are missing on disk.'),
		invalid_file_parts_missing: _('Invalid file. Important parts are missing (CA, Cert, or Private Key).'),
		key_check_failed: _('Key check failed. One security key is broken or invalid.'),
		keygen_failed: _('Key generation failed.'),
		key_type_mismatch: _('Key type mismatch'),
		ip_used_on_other_office: _('Error: This IP address is already used by another office. Every office needs a different IP address!'),
		office_name_already_exist: _('Error: An office with this name is already in the list.'),
		use_local_ipnetwork: _('Error: You cannot use this IP network! It is the local network of this router and will block all traffic.'),
		upload_key_empty: _('The uploaded file is empty.'),
		wrong_key_type: _('Wrong key type! Please upload the correct cryptographic file.')
	}
}

const CFG = Object.freeze({
	FILE: Object.freeze({
		dir_cfg: '/etc/openvpn/luci/',
		dir_keys: '/etc/openvpn/keys/',
		client_def_conf: 'client.default.conf',
		server_def_conf: 'server.default.conf',
		ca_def_crt: 'ca_default.crt',
		dh_def_pem: 'dh_default.pem',
		server_def_crt: 'server_default.crt',
		server_def_key: 'server_default.key',
		client_def_crt: 'client_default.crt',
		client_def_key: 'client_default.key',
		server_def_tls2: 'server_default.tls2.key',
		client_def_tls2: 'client_default.tls2.key',
		openvpn_keygen_lock: '/var/run/openvpn.keygen.lock',
		default_nft: 'default.nft',
		loading_img: '/luci-static/resources/icons/loading.svg',
		vpn_disabled_img: '/luci-static/resources/icons/tunnel_disabled.svg',
		vpn_enabled_img: '/luci-static/resources/icons/tunnel.svg'
	}),
	LIBEXEC: Object.freeze({
		luci_app_openvpn_plus: '/usr/libexec/luci-app-openvpn-plus',
		lanip: 'lanip',
		bestcrypto: 'bestcrypto',
		ovpnservice: 'ovpnservice',
		firewallservice: 'firewallservice',
		firewallnft: 'firewallnft',
		openssldgst: 'openssldgst',
		symlink: 'symlink',
		iroute: 'iroute',
		cleanipdns: 'cleanipdns',
		checkport: 'checkport',
		checksroute: 'checksroute',
		checkddns: 'checkddns',
		publicip: 'publicip',
		wgetddns: 'wgetddns',
		ucisortovpn: 'ucisortovpn',
		cleanup: 'cleanup',
		keymeta: 'keymeta',
		initkeys: 'initkeys'
	}),
	CMD: Object.freeze({
		openvpn: 'openvpn',
		firewall: 'firewall',
		restart: 'restart',
		start: 'start',
		stop: 'stop',
		cidr: 'cidr'
	}),
	ID: Object.freeze({
		instance: 'instance',
		openvpn_logread: 'openvpn',
		openvpn_log_stamp: 'openvpn_log_stamp',
		fwPort: 'fwPort',
		fwProto: 'fwProto',
		fw_openvpn_rule: 'openvpn_rule_',
		fw_openvpn_inc: 'openvpn_inc_',
		fw_openvpn_s2s_inc: 'openvpn_s2s_inc_',
		fw_openvpn_zone: 'openvpn_zone_',
		fw_openvpn_fwd_lan: 'openvpn_fwd_lan_',
		fw_openvpn_fwd_vpn: 'openvpn_fwd_vpn_',
		fw_openvpn_server: 'openvpn_server_',
	}),
	CONF: Object.freeze({
		modern_vpn_client: '# Modern OpenVPN Client Configuration Instance',
		modern_vpn_server: '# Modern OpenVPN Server Configuration Instance',
		openvpn_instance_status: 'openvpn.instance.status',
		certificate_and_keys_comment: '# --- Certificates & Keys ---',
		data_ciphers_aes: 'data-ciphers AES-256-GCM:AES-128-GCM:CHACHA20-POLY1305',
		data_ciphers_chacha: 'data-ciphers CHACHA20-POLY1305:AES-256-GCM:AES-128-GCM',
		data_ciphers_comment: '# Prioritize CHACHA20 on devices without hardware AES acceleration',
		explicit_exit_notify: 'explicit-exit-notify 1',
		sitetosite_routing_comment: '# Client Site-to-Site routing',
		sitetosite_add_routes_comment: '# 1. Add routes to the router system',
		sitetosite_enable_script_comment: '# 2. Enable script security to run shell commands',
		sitetosite_setenv_cname_comment: '# 3. Save names and networks of remote offices in variables',
		sitetosite_client_connect_comment: '# 4. luci-app-openvpn-plus iroute checks client name and sends the correct route',
		sitetosite_push_route_comment: '# 5. Send local network of this router to all clients',
		setenv_sitetosite_on: 'setenv sitetosite on',
		client_push_options_comment: '# --- Client Push Options ---',
		push_block_outside_dns: 'push "block-outside-dns"',
		push_redirect_gateway: 'push "redirect-gateway def1 bypass-dhcp"',
		push_redirect_gateway_ipv6: 'push "redirect-gateway ipv6"',
		setenv_client_cname_: 'setenv CLIENT_CNAME_',
		setenv_client_route_: 'setenv CLIENT_ROUTE_',
		dev_tun: 'dev tun',
		tls_timeout_5: 'tls-timeout 5',
		mssfix_1360: 'mssfix 1360',
		tun_mtu_1420: 'tun-mtu 1420'
	})
})

const ICON = Object.freeze({
	ARROW: '➔ ',
	CHECK: '✓ ',
	CHANGE: '✏️ ',
	OFFICE: '🏢 ',
	ERROR: '❌ ',
	PLUS: '➕ ',
	MINUS: '➖ ',
	HINT: '💡 ',
	INFO: 'ℹ️ ',
	LOADING: '⏳ ',
	FORWARD: '➡️ ',
	SAVE: '💾 ',
	SHIELD: '🛡️ ',
	SUCCESS: '✅ ',
	WARNING: '⚠️ ',
	DOWNLOAD: '🔽 ',
	ROCKET: '🚀 ',
	POINT: '▪ ',
	REMOVE: '🗑 ',
	MOBILE: '📱 ',
	IMPORT: '📥 ',
	ROUTING: '🔗 '
});

const OPENVPN = Object.freeze({
	ROLE: Object.freeze({
		SERVER: 'server',
		CLIENT: 'client',
	}),
	STRATEGY: Object.freeze({
		REDIRECT: 'redirect',
		SITETOSITE: 'sitetosite'
	}),
	PROTO: Object.freeze({
		UDP: 'udp',
		TCP: 'tcp'
	}),
	PORT: Object.freeze({
		s1194: '1194',
		n1194: 1194,
	}),
	IPv4: Object.freeze({
		ZERO: '0.0.0.0',
		LOOPBACK: '127.0.0.1',
		SUBNET_SERVER: '10.8.0.0',
		MASK24: '255.255.255.0'
	}),
	CONN_TYPE: Object.freeze({
		DDNS: 'ddns'
	}),
	STATE: Object.freeze({
		disabled: 'disabled',
		pending: 'pending',
		active: 'active',
		error: 'error'
	}),
	SCENARIO: Object.freeze({
		SITE_TO_SITE_CLIENT: 'sitetosite_client'
	})
});

/**
 * Main data storage for the OpenVPN page
 */
const APP_DATA_TEMPLATE = Object.freeze({
	statusClass: null,
	wizardClass: null,
	keygenClass: null,
	uptime: 0,
	serverTemplate: '',
	clientTemplate: '',
	logread: '',
	keysReady: false,
	ovpnUciSections: null,
	instances: null
});


/**
 * --- HELPER & INIT ---
 */


/**
 * Strips all accidental Windows or Mac line breaks and trims spaces.
 */
const sanitizeInputLine = function (value) {
	return String(value || '').trim().replace(/[\r\n]/g, '');
};

/**
 * Normalizes all Windows and Mac line breaks into clean UNIX line breaks for textareas.
 */
const sanitizeInputText = function (value) {
	const rawText = value ? String(value).trim() : '';
	return rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
};

/**
 * Returns an empty list using a promise when there is no data to load.
 */
const initEmptyUciView = function () {
	return Promise.resolve([]);
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
 * Global single registration for file writing and directory creation
 */
const nativeFileWriteRpc = L.rpc.declare({
	object: 'file',
	method: 'write',
	params: ['path', 'data']
});

/**
 * Native RPC wrapper to write data (replaces L.fs.write cleanly)
 */
const rpcWriteFile = async function (filepath, content) {
	const textData = (typeof content === 'string') ? content : '';
	const res = await L.resolveDefault(nativeFileWriteRpc(filepath, textData), -1);
	if (res === 0 || (res && typeof res === 'object' && res.code === 0)) {
		return 0;
	}
	return -1;
};

/**
 * Native RPC wrapper to ensure a directory exists (replaces mkdir -p via L.fs.write)
 */
const rpcMakeDir = async function (filepath) {
	const res = await L.resolveDefault(nativeFileWriteRpc(filepath, ''), -1);
	if (res === 0 || (res && typeof res === 'object' && res.code === 0)) {
		return 0;
	}
	return -1;
};

/**
 * Global single registration for checking file statistics
 */
const nativeFileRemoveRpc = L.rpc.declare({
	object: 'file',
	method: 'remove',
	params: ['path']
});

/**
 * Native RPC wrapper to delete a file using async/await (replaces L.fs.remove cleanly)
 */
const rpcRemoveFile = async function (filepath) {
	const res = await L.resolveDefault(nativeFileRemoveRpc(filepath), -1);
	if (res === 0 || (res && typeof res === 'object' && res.code === 0)) {
		return true;
	}
	return false;
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
 * Container for native ubus RPC file and execution helper functions
 */
const rpcFileCallbacks = Object.freeze({
	rpcReadFile: rpcReadFile,
	rpcWriteFile: rpcWriteFile,
	luci_app_openvpn_plus: luci_app_openvpn_plus
});

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

// Checks if a specific OpenVPN instance is enabled directly in the live UCI buffer
const isInstanceEnabled = function (instance_id) {
	return L.uci.get(CFG.CMD.openvpn, instance_id, 'enabled') === '1';
};

// Checks if at least one OpenVPN instance is active inside the provided configuration array
const isAnyInstanceEnabled = function (ovpnUciSections) {
	const ovpnSections = Array.isArray(ovpnUciSections) ? ovpnUciSections : [];

	// .some() returns true immediately if any item matches the condition
	return ovpnSections.some(function (section) {
		return section && section['.name'] && isInstanceEnabled(section['.name']);
	});
};

/**
 * Calculates a SHA256 hash using the privileged backend helper
 */
const sha256sum = async function (textToHash) {
	const res = await luci_app_openvpn_plus([CFG.LIBEXEC.openssldgst, '-sha256', String(textToHash || '')]);
	if (res.length > 0) {
		const parts = res.trim().split(/\s+/);
		return (parts && parts[0]) ? parts[0] : '';
	} else {
		return '';
	}
};

/**
 * Global helper function to determine the fallback IP and mask from browser or UCI config.
 */
const getHostnameFallback = function (returnMask) {
	// Basic regex patterns to check for valid IPv4 or IPv6 layouts
	const ipv4Pattern = /^([0-9]{1,3})\.([0-9]{1,3})\.([0-9]{1,3})\.([0-9]{1,3})$/;
	const ipv6Pattern = /^(([0-9a-fA-F]{1,4}:){1,7}|:)(:[0-9a-fA-F]{1,4}){1,7}$|^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;

	// Get the address string from the browser URL bar and remove IPv6 brackets
	let ip = (window.location.hostname || "").trim().replace(/^\[|\]$/g, '');
	let mask = '255.255.255.0';

	// If browser URL is text (like openwrt.lan), fallback to configured UCI IPs
	if (!ipv4Pattern.test(ip) && !ipv6Pattern.test(ip)) {
		ip = L.uci.get('network', 'lan', 'ipaddr') || L.uci.get('network', 'lan', 'ip6addr') || '192.168.1.1';
	}

	// Set the matching subnet mask format based on the detected IP family
	if (ipv4Pattern.test(ip)) {
		mask = L.uci.get('network', 'lan', 'netmask') || OPENVPN.IPv4.MASK24;
	} else if (ipv6Pattern.test(ip)) {
		mask = L.uci.get('network', 'lan', 'ip6assign') || '64';
	}

	if (returnMask === true) {
		return { ip: ip, mask: mask };
	} else {
		return ip;
	}
};

/**
 * Memory buffer and timestamp to cache the land and public IP string
 */
const netCache = {
	LanIp: null,
	LanIpTime: 0,
	LanIpMask: null,
	LanIpMaskTime: 0,
	PublicIp: null,
	PublicIpTime: 0,
	TIMEOUT: 60000
};

/**
 * Get LAN IP with local cache
 */
const getLanIp = async function (force) {
	const now = new Date().getTime();
	if (force !== true && netCache.LanIp !== null && Math.abs(now - netCache.LanIpTime) < netCache.TIMEOUT) {
		return netCache.LanIp;
	}
	const lanIp = await luci_app_openvpn_plus([CFG.LIBEXEC.lanip]);
	if (lanIp.length > 0) {
		netCache.LanIp = lanIp;
		netCache.LanIpTime = new Date().getTime();
		return lanIp;
	}
	return getHostnameFallback(false);
};
/**
 * Get LAN IP and Mask with local cache
 */
const getLanIpMask = async function (force) {
	const now = new Date().getTime();
	if (force !== true && netCache.LanIpMask !== null && Math.abs(now - netCache.LanIpMaskTime) < netCache.TIMEOUT) {
		return netCache.LanIpMask;
	}
	const res = await luci_app_openvpn_plus([CFG.LIBEXEC.lanip, CFG.CMD.cidr]);
	if (res.length > 0) {
		const parts = res.split('/');
		if (parts.length === 2) {
			const inputIp = parts[0];
			let inputMask = parts[1];

			// Only run the bit-shifting calculation if it is a standard IPv4 address
			if (inputIp.indexOf('.') !== -1) {
				const inlinePrefix = parseInt(parts[1], 10) || 24;
				const maskArray = [0, 0, 0, 0];

				// Rebuild explicit netmask format string from the prefix bits
				for (let bit4 = 0; bit4 < 32; bit4++) {
					if (bit4 < inlinePrefix) {
						maskArray[Math.floor(bit4 / 8)] |= (1 << (7 - (bit4 % 8)));
					}
				}
				inputMask = maskArray.join('.');
			}
			netCache.LanIpMask = { ip: inputIp, mask: inputMask };
			netCache.LanIpMaskTime = new Date().getTime();
			return netCache.LanIpMask;
		}
	}
	return getHostnameFallback(true);
};

/**
 * Get public WAN IP with local cache.
 */
const queryPublicIp = async function (force) {
	const currentHost = window.location.hostname;
	const currentTime = Date.now();
	if (force !== true && netCache.PublicIp !== null && Math.abs(currentTime - netCache.PublicIpTime) < netCache.TIMEOUT) {
		return netCache.PublicIp;
	}
	const cleanIp = await luci_app_openvpn_plus([CFG.LIBEXEC.publicip]);
	if (cleanIp.length > 0) {
		netCache.PublicIp = cleanIp;
		netCache.PublicIpTime = currentTime;
		return cleanIp;
	}
	return currentHost;
};

/**
 * Combined DDNS resolution function (checks your custom target or the public OpenWrt DDNS system)
 */
const getDdnsOrPublicIp = async function (instObj) {
	let foundDomain = '';

	// 1. Get the dynamic domain name from the .conf file data object
	if (instObj && instObj.ddns) {
		foundDomain = instObj.ddns.trim();
	}

	// If no domain was passed, try to look up the host via OpenWrt's UCI system
	if (!foundDomain) {
		try {
			// Load the ddns configuration package asynchronously
			await L.uci.load('ddns');
			const ddnsSections = L.uci.sections('ddns', 'service') || [];

			// Modern, clean loop to find the first valid lookup_host
			for (const section of ddnsSections) {
				const host = L.uci.get('ddns', section['.name'], 'lookup_host');
				if (host && host.trim() !== '') {
					foundDomain = host.trim();
					// Found a valid host target, stop searching immediately
					break;
				}
			}
		} catch {
			// Secure fallback if the ddns plugin package is missing on the system
			foundDomain = '';
		}
	}

	// 2. Resolve the domain we found or run the public IP fallback
	if (foundDomain) {
		const resolvedIp = await luci_app_openvpn_plus([CFG.LIBEXEC.checkddns, foundDomain]);
		if (resolvedIp.length > 0) {
			return resolvedIp;
		}
	}

	// 3. fallback if domain fails or is completely empty
	return await queryPublicIp(false);
};

/**
 * Clean any string from spaces, tabs, newlines, http(s)://, paths, ports and URL brackets
 */
const cleanIpOrDomain = async function (rawString) {
	if (!rawString) {
		return '';
	}
	const cleaned = await luci_app_openvpn_plus([CFG.LIBEXEC.cleanipdns, rawString]);
	if (cleaned.length > 0) {
		return cleaned;
	}
	return rawString;
};

/**
 * Check a DDNS domain name or validate a raw public WAN IP address, and verify if it is online
 */
const checkDdns = async function (targetHost) {
	if (!targetHost) {
		return { success: false, response: '' };
	}
	try {
		const res = await luci_app_openvpn_plus([CFG.LIBEXEC.checkddns, targetHost]);
		if (res.length > 0) {
			return {
				success: true,
				response: res
			};
		}
	} catch {
		return { success: false, response: '' };
	}
};

/**
 * Validate if a UDP or TCP port is open from the outside. Returns true or false.
 */
const checkPort = async function (targetHost, externalPort, internalPort, protocol) {
	if (!targetHost || !externalPort || !internalPort || !protocol) {
		return false;
	}
	const protoStr = protocol.toLowerCase();
	const res = await luci_app_openvpn_plus([CFG.LIBEXEC.checkport, targetHost, externalPort, internalPort, protoStr]);
	if (res === 'PORT_OPEN') {
		return true;
	}
	return false;
};

/**
 * Check if the main WAN router has a working static route to a remote net pointing to this VPN router.
 */
const checkStaticRoute = async function (wanIp, remoteNet) {
	if (!wanIp || !remoteNet) {
		return false;
	}
	const res = await luci_app_openvpn_plus([CFG.LIBEXEC.checksroute, wanIp, remoteNet]);
	if (res === 'ROUTE_OPEN') {
		return true;
	}
	return false;
};

/**
 * Run the background system task to update your dynamic DNS registration.
 */
const updateDdnsProvider = async function (updateUrl, domain) {
	if (!updateUrl) {
		return null;
	}
	const responseText = await luci_app_openvpn_plus([CFG.LIBEXEC.wgetddns, updateUrl, domain]);
	if ((responseText.length > 0) && (responseText.toLowerCase().indexOf('success') !== -1)) {
		return {
			raw: responseText,
			isError: false
		};
	}
	return {
		raw: responseText,
		isError: true
	};
};

/**
 * checkNetworkStructure cached data storage
 */
const networkStructure = {
	cachePromise: null,
	cacheTime: null,
	doubleNat: false,
	apMode: false,
	gateway: null,
	localSubnets: null
}

/**
 * Checks the router network structure to find double NAT, AP mode, real gateway IP and collects all active subnets
 */
const checkNetworkStructure = function (appData) {
	const privateIpRegex = /^(10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|192\.168\.|fd|fc)/i;
	// Cache is valid for 10 seconds (10000 milliseconds)
	const CACHE_TTL = 10000;
	const now = Date.now();

	// If cache exists and time difference is small, return the saved promise (Math.abs protects against system time changes - NTP syncs)
	if (networkStructure.cachePromise && (Math.abs(now - networkStructure.cacheTime) < CACHE_TTL)) {
		return networkStructure.cachePromise;
	}

	// Save the current time and create a new promise
	networkStructure.cacheTime = now;
	networkStructure.cachePromise = new Promise(function (resolve) {

		// We create an internal async function to do the heavy work safely
		const fetchNetworkData = async function () {
			let localSubnets = [];

			try {
				// 1. Get all local network devices
				const devices = await network.getDevices();
				if (Array.isArray(devices)) {
					for (const dev of devices) {
						if (!dev) continue;

						// Extract the live IP address strings array from the network objects
						const ipaddrs = dev.getIPAddrs ? dev.getIPAddrs() : [];
						let deviceMask = (dev.getNetmask && dev.getNetmask()) ? dev.getNetmask() : (dev.data && dev.data.netmask) ? dev.data.netmask : null;
						if (deviceMask === null || deviceMask === undefined || deviceMask === '') {
							deviceMask = OPENVPN.IPv4.MASK24;
						}
						for (const rawIp of ipaddrs) {
							if (!rawIp) continue;
							const ipStr = String(rawIp);
							// Use netIPCIDR to map the exact LAN network boundary
							const calculatedNet = appData.statusClass.netIPCIDR(ipStr, deviceMask);

							if (calculatedNet && !localSubnets.includes(calculatedNet)) {
								localSubnets.push(calculatedNet);
							}
						}
					}
				}

				// 2. Get the WAN (Internet) networks
				const wanNetworks = await network.getWANNetworks();
				let isDoubleNat = false;
				let isApMode = false;
				let gatewayIp = '';

				// If there is no WAN network, the router is probably in AP mode
				if (!wanNetworks || wanNetworks.length === 0) {
					isApMode = true;

					// Set values to global object before early exit
					networkStructure.doubleNat = isDoubleNat;
					networkStructure.apMode = isApMode;
					networkStructure.gateway = OPENVPN.IPv4.ZERO;
					networkStructure.localSubnets = localSubnets;

					resolve({ doubleNat: isDoubleNat, apMode: isApMode, gateway: OPENVPN.IPv4.ZERO, localSubnets: localSubnets });
					return;
				}

				// Check all found WAN networks
				for (const net of wanNetworks) {
					if (!net) continue;

					// Get the gateway IP address
					const gw4 = net.getGatewayAddr ? net.getGatewayAddr() : (net.data ? net.data.gateway : null);
					if (gw4 && gw4 !== OPENVPN.IPv4.ZERO) {
						gatewayIp = gw4;
					}

					// Check WAN IPv4 addresses for Double NAT and extract WAN net-boundaries securely [sh]
					const ipaddrs = net.getIPAddrs ? net.getIPAddrs() : [];
					let deviceMask = (net.getNetmask && net.getNetmask()) ? net.getNetmask() : (net.data && net.data.netmask) ? net.data.netmask : null;
					if (deviceMask === null || deviceMask === undefined || deviceMask === '') {
						deviceMask = OPENVPN.IPv4.MASK24;
					}
					for (const rawWanIp of ipaddrs) {
						if (!rawWanIp) continue;

						const wanIpStr = String(rawWanIp);
						const ip = wanIpStr.split('/')[0];

						// If the WAN IP is private, we have a Double NAT [sh]
						if (privateIpRegex.test(ip)) {
							isDoubleNat = true;
						}

						// Use netIPCIDR to map the exact WAN network boundary
						const calculatedWanNet = appData.statusClass.netIPCIDR(wanIpStr, deviceMask);
						if (calculatedWanNet && !localSubnets.includes(calculatedWanNet)) {
							localSubnets.push(calculatedWanNet);
						}
					}

					// Check WAN IPv6 addresses for Double NAT
					const ip6addrs = net.getIP6Addrs ? net.getIP6Addrs() : [];
					for (const rawWanIp6 of ip6addrs) {
						if (!rawWanIp6) continue;
						const ip6 = String(rawWanIp6).split('/')[0];
						if (privateIpRegex.test(ip6)) {
							isDoubleNat = true;
						}
					}
				}

				if (!gatewayIp) {
					gatewayIp = OPENVPN.IPv4.ZERO;
				}

				// Set values to global object (Fixed: changed 'gateway' to 'gatewayIp')
				networkStructure.doubleNat = isDoubleNat;
				networkStructure.apMode = isApMode;
				networkStructure.gateway = gatewayIp;
				networkStructure.localSubnets = localSubnets;

				// Return the finished network information object
				resolve({
					doubleNat: isDoubleNat,
					apMode: isApMode,
					gateway: gatewayIp,
					localSubnets: localSubnets
				});

			} catch (err) {
				// If there is an error, delete the cache so the next call tries again freshly
				console.error('Network structure background scan crashed:', err);
				networkStructure.cachePromise = null;
				resolve({ doubleNat: false, apMode: false, gateway: OPENVPN.IPv4.ZERO, localSubnets: localSubnets });
			}
		};

		// Start the async work instantly
		fetchNetworkData();
	});

	return networkStructure.cachePromise;
};

/**
 * network callbacks container
 */
const networkCallbacks = ({
	sha256sum: sha256sum,
	getLanIp: getLanIp,
	queryPublicIp: queryPublicIp,
	getDdnsOrPublicIp: getDdnsOrPublicIp,
	cleanIpOrDomain: cleanIpOrDomain,
	checkDdns: checkDdns,
	checkPort: checkPort,
	checkStaticRoute: checkStaticRoute,
	updateDdnsProvider: updateDdnsProvider,
	checkNetworkStructure: checkNetworkStructure
});

/**
 * Asynchronously loads system telemetry, network metrics, logs, and configuration templates
 */
const loadSystemTelemetry = async function (appData) {
	try {

		// Execute all filesystem reads in parallel for maximum speed
		const results = await Promise.all([
			// 1. Ensure keys directory exists
			rpcMakeDir(CFG.FILE.dir_keys),

			// 2. Check if specific files exist
			rpcStatFile(CFG.FILE.dir_keys + CFG.FILE.client_def_tls2),
			rpcStatFile(CFG.FILE.openvpn_keygen_lock),

			// 3. Read system and config files directly as strings
			rpcReadFile(CFG.FILE.dir_cfg + CFG.FILE.server_def_conf),
			rpcReadFile(CFG.FILE.dir_cfg + CFG.FILE.client_def_conf),

			// 4. Get the cleaned application log
			callLogRead({ pattern: CFG.ID.openvpn_logread })
		]);

		// Unpack the results array into meaningful variables while skipping the first index cleanly
		const [, tlsStat, lockStat, serverTpl, clientTpl, logData] = results;

		// Unlock user interface only if keys exist on disk and background lock file is removed
		appData.keysReady = (tlsStat && tlsStat.size > 0 && lockStat === null) ? true : false;

		appData.serverTemplate = serverTpl || '';
		appData.clientTemplate = clientTpl || '';
		appData.logread = logData || '';

	} catch (err) {
		// Safe fallback block to log unexpected low-level operational failures
		console.error('Failed to load system telemetry data:', err);
	}
};

/**
 * Calculates a unique IPv4 server subnet string from the instance placement number
 */
const getServerSubnetFromInstNum = function (instNum) {
	const ipSegments = OPENVPN.IPv4.SUBNET_SERVER.split('.');
	// Increment the second segment (the 8 inside 10.8.0.0) correctly
	const calculatedOctet = parseInt(ipSegments[1], 10) - 1 + parseInt(instNum, 10);
	if (calculatedOctet > 0 && calculatedOctet <= 254) {
		ipSegments[1] = String(calculatedOctet);
		return ipSegments.join('.');
	}
	return OPENVPN.IPv4.SUBNET_SERVER;
};

/**
 * Calculates a unique IPv6 server subnet prefix offset from the instance placement number
 */
const getServerIpv6SubnetFromInstNum = function (instNum) {
	const parsedNum = parseInt(instNum, 10) || 1;
	const subnetOffset = parsedNum - 1;
	return 'fd00:db8:0:' + subnetOffset + '::/64';
};

/**
 * Executes a hardware cpu check to determine and return if the optimal cipher is AES
 */
const checkOptimalDataCipherAES = async function () {

	const res = await luci_app_openvpn_plus([CFG.LIBEXEC.bestcrypto]);
	if (res.length > 0) {
		if (res === 'AES') {
			return true
		} else {
			return false;
		}
	}
	return true;
};

/**
 * Compresses and formats the configuration text. Optionally removes dynamic blocks defined by start and end identifiers.
 */
const formatOpenVpnConfig = function (configText, removelines) {
	if (!configText || typeof configText !== 'string') {
		return '';
	}
	const filters = Array.isArray(removelines) ? removelines : [];
	const lines = configText.split('\n');
	let formattedLines = [];
	let skipBlock = false;
	let currentLastId = '';

	for (let i = 0; i < lines.length; i++) {
		let currentLine = lines[i].trim();

		// SECTION REMOVAL LOGIC
		{
			// If we are currently skipping lines, check if this line contains the end marker
			if (skipBlock) {
				// Check if the current line starts with the active lastid prefix
				if (currentLine.indexOf(currentLastId) === 0) {
					// check if the NEXT line is also part of the removal block prefix, if not stop skipping after this
					let nextLine = (i + 1 < lines.length) ? lines[i + 1].trim() : '';
					if (nextLine.indexOf(currentLastId) !== 0) {
						skipBlock = false;
						currentLastId = '';
					}
				}
				// Skip this line
				continue;
			}
			// Check if a new removal block starts on this line
			let matchedFilter = false;
			for (let j = 0; j < filters.length; j++) {
				if (filters[j] && currentLine.indexOf(filters[j].startid) === 0) {
					skipBlock = true;
					currentLastId = filters[j].lastid;
					matchedFilter = true;
					break;
				}
			}
			if (matchedFilter) {
				// Skip the start line
				continue;
			}
		}
		// Skip entirely empty lines to reduce all double newlines first
		if (currentLine === '') {
			continue;
		}
		// Condition: From line 2 onwards, inject a clean empty line above comments (#)
		if (currentLine.indexOf('#') === 0 && formattedLines.length > 0) {
			formattedLines.push('');
		}
		formattedLines.push(currentLine);
	}
	let cleanConfig = formattedLines.join('\n');
	return cleanConfig.trim() + '\n';
};

/**
 * Escapes dot characters to safely rewrite default crypto filenames into unique instance paths
 */
const escapeRegExp = function (str) {
	return str.replace(/\./g, '\\.');
};

/**
 * Generate configuration file text for an OpenVPN server profile instance
 */
const generateServerConfig = async function (appData, newInstanceItem, wizardParams) {
	if (!appData.serverTemplate) {
		return '';
	}

	const id = newInstanceItem.id;
	const instNum = newInstanceItem.instNum;

	const chosenPort = (wizardParams && wizardParams.port) ? wizardParams.port : newInstanceItem.port;
	const chosenProto = (wizardParams && wizardParams.proto) ? wizardParams.proto : OPENVPN.PROTO.UDP;
	const displayName = (wizardParams && wizardParams.displayName) ? wizardParams.displayName.trim() : '';

	// Calculate the external client port target safely
	let externPortValue = chosenPort;
	if (wizardParams && wizardParams.portExtern) {
		externPortValue = wizardParams.portExtern;
	}

	// Save the correct port back into the shared object property
	newInstanceItem.port = chosenPort;

	// Calculate unique server subnets using helper functions
	const targetIpv4Subnet = getServerSubnetFromInstNum(instNum);
	const targetIpv6Subnet = getServerIpv6SubnetFromInstNum(instNum);
	const optimalDataCipherAES = await checkOptimalDataCipherAES();

	let config = appData.serverTemplate
		.replace(new RegExp(escapeRegExp(CFG.FILE.ca_def_crt), 'g'), 'ca_' + id + '.crt')
		.replace(new RegExp(escapeRegExp(CFG.FILE.server_def_crt), 'g'), 'server_' + id + '.crt')
		.replace(new RegExp(escapeRegExp(CFG.FILE.server_def_key), 'g'), 'server_' + id + '.key')
		.replace(new RegExp(escapeRegExp(CFG.FILE.dh_def_pem), 'g'), 'dh_' + id + '.pem')
		.replace(new RegExp(escapeRegExp(CFG.FILE.server_def_tls2), 'g'), 'server_' + id + '.tls2.key')
		.replace(CFG.CONF.dev_tun, CFG.CONF.dev_tun + String(instNum - 1))
		.replace(/^port\s+\d+/m, 'port ' + chosenPort)
		.replace(/^setenv\s+portextern\s+\d+/m, 'setenv portextern ' + externPortValue)
		.replace(/^proto\s+\S+/m, 'proto ' + chosenProto)
		.replace(/^server\s+10\.8\.0\.0/m, 'server ' + targetIpv4Subnet)
		.replace(/^server-ipv6\s+fd00:db8:0:1::\/64/m, 'server-ipv6 ' + targetIpv6Subnet)
		.replace(CFG.CONF.openvpn_instance_status, 'openvpn.instance' + instNum + '.status');

	if (displayName) {
		config = config.replace(CFG.CONF.modern_vpn_server, CFG.CONF.modern_vpn_server + ' #' + instNum + ' (' + displayName + ')');
	} else {
		config = config.replace(CFG.CONF.modern_vpn_server, CFG.CONF.modern_vpn_server + ' #' + instNum);
	}

	if (!optimalDataCipherAES) {
		config = config.replace(CFG.CONF.data_ciphers_aes, CFG.CONF.data_ciphers_comment + "\n" + CFG.CONF.data_ciphers_chacha);
	}

	let blocksToRemove = [];
	if (chosenProto === OPENVPN.PROTO.UDP) {
		// remove tls_timeout_5 if runing on UDP
		config = config.replace(CFG.CONF.tls_timeout_5, '');
	} else {
		// remove mssfix 1360 if running on TCP
		config = config.replace(CFG.CONF.mssfix_1360, '');
		config = config.replace(CFG.CONF.tun_mtu_1420, '');
	}

	// Option A: Mobile clients profile settings (Route all traffic over VPN)
	if (wizardParams && wizardParams.strategy === OPENVPN.STRATEGY.REDIRECT) {
		config += '\n# Mobile Devices Routing\n\n';
		if (config.indexOf(CFG.CONF.push_redirect_gateway) === -1) {
			config += CFG.CONF.push_redirect_gateway + '\n';
		}
		if (config.indexOf(CFG.CONF.push_redirect_gateway_ipv6) === -1) {
			config += CFG.CONF.push_redirect_gateway_ipv6 + '\n';
		}
		if (config.indexOf(CFG.CONF.push_block_outside_dns) === -1) {
			config += CFG.CONF.push_block_outside_dns + '\n';
		}

		// Fallback if missing in defalt config file
		if (config.indexOf('dhcp-option DNS') === -1) {
			const localLanIp = await getLanIp(true);
			if (localLanIp && localLanIp.trim()) {
				config += 'push "dhcp-option DNS ' + localLanIp.trim() + '"\n';
				config += 'push "dhcp-option DNS 9.9.9.9"\n';
				config += 'push "dhcp-option DNS 149.112.112.112"\n';
			} else {
				config += 'push "dhcp-option DNS 9.9.9.9"\n';
				config += 'push "dhcp-option DNS 149.112.112.112"\n';
			}
		}
		if (config.indexOf('dhcp-option DNS6') === -1) {
			config += 'push "dhcp-option DNS6 2620:fe::fe"\n';
			config += 'push "dhcp-option DNS6 2620:fe::9"\n';
		}
	}

	// Option B: Office network settings (Universal Multi-Client Site-to-Site LAN-LAN Setup)
	if (wizardParams && wizardParams.strategy === OPENVPN.STRATEGY.SITETOSITE) {

		// Remove push dhcp-option DNS for sito-to-site connection
		config = config.replace(CFG.CONF.client_push_options_comment, '');
		config = config.replace(/push "dhcp-option DNS.*\n/g, '');
		config = config.replace(CFG.CONF.push_block_outside_dns, '');

		config += '\n' + CFG.CONF.sitetosite_routing_comment + '\n';
		config += CFG.CONF.setenv_sitetosite_on + '\n\n';

		// Load all registered client offices from the wizard array list
		const targetClients = Array.isArray(wizardParams.clients) ? wizardParams.clients : [];

		config += CFG.CONF.sitetosite_add_routes_comment + '\n';
		targetClients.forEach(function (client) {
			const isClientIpv6 = (client.subnet.indexOf(':') !== -1);
			if (isClientIpv6 === true) {
				// Use dynamic standard CIDR or prefix notation format for IPv6
				config += 'route-ipv6 ' + client.subnet + (client.mask ? '/' + client.mask : '') + '\n';
			} else {
				config += 'route ' + client.subnet + ' ' + client.mask + '\n';
			}
		});
		config += '\n';

		config += CFG.CONF.sitetosite_enable_script_comment + '\n';
		config += 'script-security 2\n\n';

		config += CFG.CONF.sitetosite_setenv_cname_comment + '\n';
		targetClients.forEach(function (client, index) {
			const num = index + 1;
			const isClientIpv6 = (client.subnet.indexOf(':') !== -1);

			config += CFG.CONF.setenv_client_cname_ + num + ' "' + client.commonName.trim() + '"\n';
			if (isClientIpv6 === true) {
				config += CFG.CONF.setenv_client_route_ + num + ' "iroute-ipv6 ' + client.subnet + (client.mask ? '/' + client.mask : '') + '"\n';
			} else {
				config += CFG.CONF.setenv_client_route_ + num + ' "iroute ' + client.subnet + ' ' + client.mask + '"\n';
			}
		});
		config += '\n';

		if (targetClients.length > 0) {
			config += CFG.CONF.sitetosite_client_connect_comment + '\n';
			config += 'client-connect "' + CFG.LIBEXEC.luci_app_openvpn_plus + ' ' + CFG.LIBEXEC.iroute + '"' + '\n\n';
		}

		// Find local LAN network details of this server to push them back to clients
		const localLan = await getLanIpMask(true);
		if (localLan.ip) {

			config += CFG.CONF.sitetosite_push_route_comment + '\n';

			const isLocalIpv6 = (localLan.ip.indexOf(':') !== -1);
			if (isLocalIpv6 === true) {
				// ipv6: get subnet with CIRD (e.g fd00:db8::/64)
				const localSubnet = appData.statusClass.netIPCIDR(localLan.ip, localLan.mask);
				config += 'push "route-ipv6 ' + localSubnet + '"\n';
			} else {
				// ipv4: get subnet without CIRD (e.g 192.168.10.0)
				const localSubnet = appData.statusClass.netIPCIDR(localLan.ip, null);
				config += 'push "route ' + localSubnet + ' ' + localLan.mask + '"\n';
			}
		}
	}

	if (wizardParams && wizardParams.ddnsOrPublicIp) {
		const targetHost = wizardParams.ddnsOrPublicIp.trim();
		const hasLetters = /[a-zA-Z]/.test(targetHost);

		if (wizardParams.connectionType === OPENVPN.CONN_TYPE.DDNS) {
			// Scenario A: Active internal dynamic DNS updater script mode
			config += '\n# Public Dynamic DNS (Autonomous background update routine)\n';
			config += 'setenv DDNS "' + targetHost + '"\n';
			config += 'setenv DDNS_PROVIDER "' + wizardParams.ddnsProvider + '"\n';
			config += 'setenv DDNS_URL "' + wizardParams.ddnsUrl + '"\n';
		} else if (hasLetters === true) {
			// Fallback: User provided a domain name but uses an external DDNS client
			config += '\n# Public Domain (Managed by an external DDNS client or provider)\n';
			config += 'setenv PUBLIC_DOMAIN ' + targetHost + '\n';
		} else if (wizardParams.isStaticIp === true) {
			// Line connection with permanent static public IP
			config += '\n# Public Static IP\n';
			config += 'setenv PUBLIC_STATIC_IP ' + targetHost + '\n';
		} else {
			// Temporary dynamic public IP address with standard connection warnings
			config += '\n# Public Dynamic IP\n';
			config += '# [WARNING] Value will change on ISP reconnection and your VPN connection will disconnect!\n';
			config += '# Please use a DDNS domain name to prevent this.\n';
			config += 'setenv PUBLIC_DYNAMIC_IP ' + targetHost + '\n';
		}
	}

	// BACKUP RULE: If for some reason the template didn't have the line, add it as fallback
	if (config.indexOf('setenv portextern') === -1) {
		config += '\nsetenv portextern ' + externPortValue + '\n';
	}

	return formatOpenVpnConfig(config, blocksToRemove);
};

/**
 * Finds the last active server ID, its configuration port number, and its protocol (udp/tcp)
 */
const getLastServerIdAndPort = function (currentId, defaultPort, appData) {
	const result = { id: currentId, port: defaultPort, proto: OPENVPN.PROTO.UDP };

	if (!appData || !Array.isArray(appData.instances)) {
		return result;
	}

	const instances = appData.instances;

	// Loop backwards directly through the structural instances array in RAM
	for (let i = instances.length - 1; i >= 0; i--) {
		const inst = instances[i];

		// Find the nearest previous server instance that is not the current one
		if (inst && inst.role === OPENVPN.ROLE.SERVER && inst.id !== currentId) {
			result.id = inst.id;
			if (inst.port && !isNaN(inst.port)) {
				result.port = parseInt(inst.port, 10);
			}
			if (inst.proto) {
				result.proto = inst.proto.toLowerCase();
			}
			break;
		}
	}
	return result;
};


/**
 * Calculates a unique loopback client IP address from the instance number
 */
const getClientIpFromInstNum = function (instNum) {
	const ipSegments = OPENVPN.IPv4.LOOPBACK.split('.');

	// Increment the last digit using the unique instance placement number
	const lastSegment = parseInt(ipSegments[3], 10) - 1 + parseInt(instNum, 10);

	if (lastSegment > 0 && lastSegment <= 254) {
		ipSegments[3] = String(lastSegment);
		return ipSegments.join('.');
	}
	return OPENVPN.IPv4.LOOPBACK;
};

/**
 * Generate configuration file text for an OpenVPN client profile instance
 */
const generateClientConfig = async function (appData, newInstanceItem, wizardParams) {
	if (!appData.clientTemplate) {
		return '';
	}

	const id = newInstanceItem.id;
	const instNum = newInstanceItem.instNum;

	const chosenPort = (wizardParams && wizardParams.port) ? wizardParams.port : newInstanceItem.port;
	const chosenProto = (wizardParams && wizardParams.proto) ? wizardParams.proto : newInstanceItem.proto;
	const remoteServer = (wizardParams && wizardParams.remoteServer) ? wizardParams.remoteServer.trim() : getClientIpFromInstNum(instNum);
	const remoteServerLan = (wizardParams && wizardParams.remoteServerLan) ? wizardParams.remoteServerLan.trim() : '';
	const displayName = (wizardParams && wizardParams.displayName) ? wizardParams.displayName.trim() : '';
	const optimalDataCipherAES = await checkOptimalDataCipherAES();

	// 1. Prepare base replacement variables for crypto paths
	let config = appData.clientTemplate
		.replace(new RegExp(escapeRegExp(CFG.FILE.ca_def_crt), 'g'), 'ca_' + id + '.crt')
		.replace(new RegExp(escapeRegExp(CFG.FILE.client_def_crt), 'g'), 'client_' + id + '.crt')
		.replace(new RegExp(escapeRegExp(CFG.FILE.client_def_key), 'g'), 'client_' + id + '.key')
		.replace(new RegExp(escapeRegExp(CFG.FILE.client_def_tls2), 'g'), 'client_' + id + '.tls2.key')
		.replace(CFG.CONF.dev_tun, CFG.CONF.dev_tun + String(instNum - 1))
		.replace(CFG.CONF.openvpn_instance_status, 'openvpn.instance' + instNum + '.status');

	if (displayName) {
		config = config.replace(CFG.CONF.modern_vpn_client, CFG.CONF.modern_vpn_client + ' #' + instNum + ' (' + displayName + ')');
	} else {
		config = config.replace(CFG.CONF.modern_vpn_client, CFG.CONF.modern_vpn_client + ' #' + instNum);
	}

	if (!optimalDataCipherAES) {
		config = config.replace(CFG.CONF.data_ciphers_aes, CFG.CONF.data_ciphers_comment + "\n" + CFG.CONF.data_ciphers_chacha);
	}

	if (chosenProto === OPENVPN.PROTO.TCP) {
		// remove explicit-exit-notify 1, mssfix 1360 and tun-mtu 1420 if running on TCP
		config = config.replace(CFG.CONF.explicit_exit_notify, '');
		config = config.replace(CFG.CONF.mssfix_1360, '');
		config = config.replace(CFG.CONF.tun_mtu_1420, '');
	}

	// 2. Inject remote server connection paths and transport protocols
	let newRemote = 'remote ' + remoteServer + ' ' + chosenPort;
	if (remoteServerLan !== '') {
		newRemote = newRemote + '\nsetenv remotelan ' + remoteServerLan;
	}

	config = config.replace(/^remote\s+\S+\s+\d+/m, newRemote);
	config = config.replace(/^proto\s+\S+/m, 'proto ' + chosenProto);

	return formatOpenVpnConfig(config);
};

/**
 * Compiles the final standalone .ovpn profile text with embedded keys
 */
const compileOvpnProfileText = async function (cname, targetHost, targetPort, proto, cryptoAssets, appData, instNum, isSiteToSite) {

	const optimalDataCipherAES = await checkOptimalDataCipherAES();

	let new_remote = 'remote ' + targetHost + ' ' + targetPort;
	if (isSiteToSite) {
		const localLan = await getLanIpMask(true);
		const localSubnet = appData.statusClass.netIPCIDR(localLan.ip, localLan.mask);
		new_remote = new_remote + '\nsetenv remotelan ' + localSubnet;
	}

	// Remove old crypto key references - ovpn profile comes with embedded keys
	let ovpn = appData.clientTemplate
		.replace(CFG.CONF.modern_vpn_client, CFG.CONF.modern_vpn_client + ' #' + instNum + ' (' + cname + ')')
		.replace(CFG.CONF.certificate_and_keys_comment, '')
		.replace(/^ca\s+\S+\r?\n/m, '')
		.replace(/^cert\s+\S+\r?\n/m, '')
		.replace(/^key\s+\S+\r?\n/m, '')
		.replace(/^tls-crypt-v2\s+\S+\r?\n/m, '')
		.replace(/^remote\s+\S+\s+\d+/m, new_remote)
		.replace(/^proto\s+\S+/m, 'proto ' + proto);

	if (isSiteToSite !== true) {
		ovpn = ovpn.replace(/^.*openvpn\.instance\.status.*\n/m, '')
		ovpn = ovpn.replace(/^.*status-version.*\n/m, '')
	}

	if (!optimalDataCipherAES) {
		ovpn = ovpn.replace(CFG.CONF.data_ciphers_aes, CFG.CONF.data_ciphers_comment + '\n' + CFG.CONF.data_ciphers_chacha);
	}

	if (proto === OPENVPN.PROTO.TCP) {
		ovpn = ovpn.replace(CFG.CONF.mssfix_1360, '');
		ovpn = ovpn.replace(CFG.CONF.tun_mtu_1420, '');
	}

	// Collapse three or more consecutive newlines down to exactly one empty line
	ovpn = ovpn.replace(/\n{3,}/g, '\n\n');
	ovpn += 'setenv client-cname ' + cname + '\n\n';

	if (cryptoAssets.ca && typeof cryptoAssets.ca.trim === 'function') {
		const rawCa = cryptoAssets.ca.trim();
		const cleanCa = rawCa.replace(/-----BEGIN[^\n]*PRIVATE KEY-----[\s\S]*?-----END[^\n]*PRIVATE KEY-----\n*/g, '');
		ovpn += '<ca>\n' + cleanCa.trim() + '\n</ca>\n\n';
	}

	if (cryptoAssets.cert && typeof cryptoAssets.cert.trim === 'function') {
		ovpn += '<cert>\n' + cryptoAssets.cert.trim() + '\n</cert>\n\n';
	}

	if (cryptoAssets.key && typeof cryptoAssets.key.trim === 'function') {
		ovpn += '<key>\n' + cryptoAssets.key.trim() + '\n</key>\n\n';
	}

	// Embedded client asset delivery wrapped into modern asymmetric tls-crypt-v2 XML layout tags
	if (cryptoAssets.tlsCrypt && typeof cryptoAssets.tlsCrypt.trim === 'function' && cryptoAssets.tlsCrypt.trim()) {
		ovpn += '<tls-crypt-v2>\n' + cryptoAssets.tlsCrypt.trim() + '\n</tls-crypt-v2>\n';
	}

	return ovpn;
};

/**
 * Checks and creates all configuration and key files for an instance
 */
const syncInstanceFiles = async function (newInstanceItem, appData, wizardParams) {
	const id = newInstanceItem.id;
	const calculatedPort = appData.statusClass.calcPortFromId(id, newInstanceItem.instNum);
	const rolePrefix = newInstanceItem.role + '_';
	const isServer = (newInstanceItem.role === OPENVPN.ROLE.SERVER);

	if (!wizardParams && newInstanceItem.role === OPENVPN.ROLE.CLIENT) {
		// Get loopback server data if simple new client instance
		const serverData = getLastServerIdAndPort(id, calculatedPort, appData);
		newInstanceItem.loopbackServerId = serverData.id;
		newInstanceItem.port = serverData.port;
		newInstanceItem.proto = serverData.proto;
	} else if (!wizardParams && isServer) {
		newInstanceItem.port = calculatedPort;
	} else if (wizardParams && wizardParams.port) {
		// Ensure the wizard port is also mirrored inside the object property instantly
		newInstanceItem.port = parseInt(wizardParams.port, 10);
		if (wizardParams.proto) {
			newInstanceItem.proto = wizardParams.proto;
		}
	}

	const def_crt = isServer ? CFG.FILE.server_def_crt : CFG.FILE.client_def_crt;
	const def_key = isServer ? CFG.FILE.server_def_key : CFG.FILE.client_def_key;
	const def_tls = isServer ? CFG.FILE.server_def_tls2 : CFG.FILE.client_def_tls2;

	// Push all tasks into an array to fire them simultaneously
	const filePromises = [
		initFile(CFG.FILE.dir_cfg + id + '.conf', null, newInstanceItem, appData, wizardParams),
		initFile(CFG.FILE.dir_keys + 'ca_' + id + '.crt', CFG.FILE.dir_keys + CFG.FILE.ca_def_crt, newInstanceItem, appData, wizardParams),
		initFile(CFG.FILE.dir_keys + rolePrefix + id + '.crt', CFG.FILE.dir_keys + def_crt, newInstanceItem, appData, wizardParams),
		initFile(CFG.FILE.dir_keys + rolePrefix + id + '.key', CFG.FILE.dir_keys + def_key, newInstanceItem, appData, wizardParams),
		initFile(CFG.FILE.dir_keys + rolePrefix + id + '.tls2.key', CFG.FILE.dir_keys + def_tls, newInstanceItem, appData, wizardParams)
	];

	if (isServer) {
		filePromises.push(
			initFile(CFG.FILE.dir_keys + 'dh_' + id + '.pem', CFG.FILE.dir_keys + CFG.FILE.dh_def_pem, newInstanceItem, appData, wizardParams)
		);
		filePromises.push(
			initFile(CFG.FILE.dir_cfg + id + '.nft', CFG.FILE.dir_cfg + CFG.FILE.default_nft, newInstanceItem, appData, wizardParams)
		);
	}

	// We wait for all parallel file transmissions
	return await Promise.all(filePromises);
};

/**
 * Reads a file or creates it with default text if missing
 */
const initFile = async function (customPath, defaultPath, newInstanceItem, appData, wizardParams) {
	// Try to read the file from the disk
	const existingContent = await rpcReadFile(customPath);
	if (existingContent) {
		return existingContent;
	} else {

		// STEP 1: If the missing file is a configuration profile (.conf), compile it now
		if (customPath.indexOf('.conf') !== -1) {
			let configContent = '';

			if (newInstanceItem.role === OPENVPN.ROLE.CLIENT) {
				configContent = await generateClientConfig(appData, newInstanceItem, wizardParams);
			} else {
				configContent = await generateServerConfig(appData, newInstanceItem, wizardParams);
			}
			newInstanceItem.confContent = configContent;

			// Write the new config file and return its content inline
			await rpcWriteFile(customPath, configContent);
			return configContent;
		}

		// If no default fallback path is given, stop here safely
		if (!defaultPath) {
			return '';
		}

		// STEP 2: For local loopback tests, copy the server's keys so the client certificates match perfectly.
		let sourcePath = defaultPath;
		if (!wizardParams && newInstanceItem.role === OPENVPN.ROLE.CLIENT && newInstanceItem.loopbackServerId && newInstanceItem.loopbackServerId !== newInstanceItem.id) {
			// Example: Change "ca_instance2.crt" to search for "ca_instance1.crt" on the disk
			const fileName = customPath.substring(customPath.lastIndexOf('/') + 1);
			const serverFileName = fileName.replace(newInstanceItem.id, newInstanceItem.loopbackServerId);
			sourcePath = customPath.substring(0, customPath.lastIndexOf('/') + 1) + serverFileName;
		}

		// STEP 3: Read the selected source file with a safe fallback to an empty string
		let sourceContent = '';
		const rawSource = await rpcReadFile(sourcePath);
		if (rawSource) {
			sourceContent = String(rawSource).trim();
		}

		let content = '';
		if (sourceContent.length === 0 && sourcePath !== defaultPath) {
			// SAFETY FALLBACK: If the local file was empty or missing, fall back to default files
			let fallbackContent = '';
			const rawFallback = await rpcReadFile(defaultPath);
			if (rawFallback) {
				fallbackContent = String(rawFallback || '').trim();
			}
			if (fallbackContent.length > 0) {
				content = fallbackContent;
			}
		} else {
			if (sourceContent.length > 0) {
				content = sourceContent;
			}
		}
		if (content.length > 0) {
			// Write the verified clean content to the destination folder
			await rpcWriteFile(customPath, content);
		}
		return content;
	}
};

/**
 * Asynchronously loads the settings and running state for all profiles
 */
const loadInstanceData = async function (appData) {
	const ovpnUciSections = appData.ovpnUciSections || [];

	try {
		// Get openvpn service data and system stats at the same time in parallel
		const results = await Promise.all([
			rpcGetServiceStatus(),
			appData.statusClass.getSystemUptime()
		]);

		const serviceData = results[0];
		const instancesObj = serviceData.instances || {};
		const systemUptime = results[1];

		const syncPromises = [];
		ovpnUciSections.forEach(function (s, idx) {
			const id = s['.name'];
			const instNum = appData.statusClass.getInstanceNumber(id, idx + 1);
			const role = L.uci.get(CFG.CMD.openvpn, id, 'role') || OPENVPN.ROLE.SERVER;
			const devName = appData.statusClass.getDevName(id, instNum, false);

			// Initialize a clean newInstanceItem template for the synchronization loop
			const newInstanceItem = Object.assign({}, appData.statusClass.INSTANCE_TEMPLATE, {
				id: id,
				instNum: instNum,
				devName: devName,
				role: role,
				connectedClients: []
			});

			syncPromises.push(syncInstanceFiles(newInstanceItem, appData, null));
		});

		// Await all files to be synchronized in parallel before reading status structures
		await Promise.all(syncPromises);

		const updatedInstances = await appData.statusClass.readInstanceStatus(ovpnUciSections, instancesObj, systemUptime);
		await appData.statusClass.refreshNetStat(updatedInstances);
		appData.instances = updatedInstances;

	} catch (err) {
		console.error('Failed to load instance configuration data engine:', err);
		appData.instances = await appData.statusClass.readInstanceStatus(ovpnUciSections, {}, 0);
	}
};



/**
 * --- SAVE AND RESTART ---
 */


/**
 * Define OpenVPN service start / stop with luci_app_openvpn_plus ovpnservice
 */
const ovpnServiceStartStop = {
	Request: false,
	uciSort: false,
	Action: CFG.CMD.start,
	Instance: '',
	checkRequest: function () {
		if (this.Request === true) {
			this.Request = false;

			// Freeze the current state into local variables before entering the async timeout closure
			const targetAction = this.Action;
			const targetInstance = this.Instance;
			this.Instance = '';
			setTimeout(async function () {
				try {
					await luci_app_openvpn_plus([CFG.LIBEXEC.ovpnservice, targetAction, targetInstance]);
				} catch {
					console.error('Asynchronous background OpenVPN service call failed: ' + CFG.LIBEXEC.luci_app_openvpn_plus + ' ' + CFG.LIBEXEC.ovpnservice + ' ' + targetAction + ' ' + targetInstance);
				}
			}, 0);
			if (this.uciSort === true) {
				this.uciSort = false;
				setTimeout(async function () {
					try {
						await luci_app_openvpn_plus([CFG.LIBEXEC.ucisortovpn]);
					} catch {
						console.error('Asynchronous background call "uci reorder openvpn.instanceX=Y" failed: ' + CFG.LIBEXEC.luci_app_openvpn_plus + ' ' + CFG.LIBEXEC.ucisortovpn);
					}
				}, 3000);
			}
		}
		return;
	}
};

/**
 * Trigger ovpnPending state for 5 seconds
 */
const ovpnPending = {
	_t: null,
	init: function (appData) {
		if (appData) {
			this._t = this._t = appData.statusClass.ovpnPending.trigger;
		}
	},
	trigger: function () {
		if (typeof this._t === 'function') {
			this._t();
		}
	}
};

/**
 * Intercepts the native LuCI apply event to trigger background OpenVPN and firewall lifecycle updates smoothly
 */
if (typeof L.ui.changes.apply === 'function') {

	const nativeLuCiApply = L.ui.changes.apply;

	L.ui.changes.apply = function () {
		const hookArgs = arguments;

		// Trigger all background workers right before the changes are applied to the system
		ovpnPending.trigger();
		reloadFirewall.checkRequest();
		ovpnServiceStartStop.checkRequest();

		// UNBLOCKED MAIN PATH: Preserves strict 'this' binding contexts for UI overlays
		return nativeLuCiApply.apply(this, hookArgs);
	};
}

/**
 * Saves all pending UCI modifications and refreshes the LuCI changes modal view safely
 */
const uciSaveApply = function (initCallback, savedCallback, finallyCallback, errorCallback) {

	// 1. Write current modifications to the active memory staging area
	L.uci.save();

	// 2. Initialize the LuCI changes manager framework
	L.ui.changes.init().then(function () {
		if (typeof initCallback === 'function') {
			initCallback();
		}
		// 3. Re-initialize and update the modal layout view with the new changes
		if (L.ui && L.ui.changes && typeof L.ui.changes.displayChanges === 'function') {
			L.ui.changes.displayChanges();
		}
	}).then(function () {
		// Triggers after the staging process finished without errors
		if (typeof savedCallback === 'function') {
			savedCallback();
		}
	}).catch(function (err) {
		// Catches any broken promises or core framework execution errors
		if (typeof errorCallback === 'function') {
			errorCallback(err);
		}
	}).finally(function () {
		// Always runs at the very end of the execution chain
		if (typeof finallyCallback === 'function') {
			finallyCallback();
		}
	});
};

/**
 * Shows the LuCI changes modal and restarts the OpenVPN instance safely
 */
const uciSaveApplyRestart = async function (instance_id) {

	const needsRestart = isInstanceEnabled(instance_id);

	if (needsRestart == true) {
		const universalDate = new Date().toISOString().slice(0, 19) + 'Z';
		L.uci.set(CFG.CMD.openvpn, instance_id, 'restart', universalDate);
	}

	ovpnServiceStartStop.Request = true;
	ovpnServiceStartStop.Instance = instance_id
	ovpnServiceStartStop.Action = needsRestart ? CFG.CMD.restart : CFG.CMD.stop;


	// Save all current modifications to the uci memory buffer
	L.uci.save();

	// Open the standard LuCI review and apply changes window
	try {
		// Wait for the modal engine initialization
		await L.ui.changes.init();

		if (L.ui.changes.displayChanges && typeof L.ui.changes.displayChanges === 'function') {
			L.ui.changes.displayChanges();

			// requestAnimationFrame guarantees the DOM node is fully accessible before injection runs.
			window.requestAnimationFrame(function () {
				if (needsRestart == true) {
					const modalNode = document.querySelector('.modal.uci-dialog') || document.querySelector('.modal');
					if (modalNode) {
						const infoNotice = E('div', {
							'class': 'alert-message info',
							'style': 'margin:15px 0 15px 0; padding:12px; font-weight:bold; font-size:12px; line-height:1.5; ' +
								'border-left:4px solid var(--primary-color-high, #1976d2); ' +
								'background: color-mix(in srgb, var(--primary-color-high, #1976d2) 6%, transparent); ' +
								'color: color-mix(in srgb, var(--text-color-medium, #71717a) 85%, #0055ff); ' +
								'border-radius:4px;'
						}, ICON.WARNING + TXT.MSG.config_changed_reload);

						const titleHeader = modalNode.querySelector('h4');
						if (titleHeader && titleHeader.nextSibling) {
							modalNode.insertBefore(infoNotice, titleHeader.nextSibling);
						} else {
							modalNode.appendChild(infoNotice);
						}
					}
				}
			});
		}
	} catch {
		// Silent fallback on failure
	}
};


/**
 * --- OVPN PROFILES ---
 */


/**
 * Reads a profile file, tests keys with keymeta, and saves them to the router.
 */
const importOvpnClientProfile = async function (ovpnContent, instanceId) {
	if (!ovpnContent || !ovpnContent.trim()) {
		throw new Error(ICON.ERROR + TXT.ERROR.upload_key_empty);
	}

	// Fix line endings for Windows, Mac, and Linux instantly
	const content = sanitizeInputText(ovpnContent);

	// Setup clean variables for the router files
	let caContent = '';
	let certContent = '';
	let keyContent = '';
	let tlsCryptContent = '';

	// Try to find native OpenVPN XML tags in the text profile
	const caXml = content.match(/<ca>([\s\S]*?)<\/ca>/);
	const certXml = content.match(/<cert>([\s\S]*?)<\/cert>/);
	const keyXml = content.match(/<key>([\s\S]*?)<\/key>/);
	const tlsCryptXml = content.match(/<tls-crypt-v2>([\s\S]*?)<\/tls-crypt-v2>/);

	const blocksToScan = [];
	let isXmlSource = false;

	// CHECK PATH: Test if we have XML tags or if we must scan raw PEM blocks
	const hasValidCaXml = (caXml && caXml[1] && caXml[1].trim());
	const hasValidCertXml = (certXml && certXml[1] && certXml[1].trim());
	const hasValidKeyXml = (keyXml && keyXml[1] && keyXml[1].trim());

	if (hasValidCaXml || hasValidCertXml || hasValidKeyXml) {
		// This file has valid XML tags
		isXmlSource = true;

		if (hasValidCaXml) { blocksToScan.push({ type: 'ca', text: caXml[1].trim() }); }
		if (hasValidCertXml) { blocksToScan.push({ type: 'cert', text: certXml[1].trim() }); }
		if (hasValidKeyXml) { blocksToScan.push({ type: 'key', text: keyXml[1].trim() }); }
		if (tlsCryptXml && tlsCryptXml[1] && tlsCryptXml[1].trim()) {
			blocksToScan.push({ type: 'tlscrypt-v2', text: tlsCryptXml[1].trim() });
		}
	} else {
		// Fallback: This is a pure keys.crt bundle. Get PEM text blocks using regex.
		const certArray = content.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g) || [];
		const keyArray = content.match(/-----BEGIN[^\n]*?PRIVATE KEY-----[\s\S]*?-----END[^\n]*?PRIVATE KEY-----/g) || [];
		const tlsCryptArray = content.match(/-----BEGIN OpenVPN tls-crypt-v2 client key-----[\s\S]*?-----END OpenVPN tls-crypt-v2 client key-----/g) || [];

		const combinedPem = [].concat(certArray, keyArray, tlsCryptArray);
		for (let i = 0; i < combinedPem.length; i++) {
			if (combinedPem[i]) {
				blocksToScan.push({ type: 'unknown', text: combinedPem[i].trim() });
			}
		}
	}

	// SCAN LOOP: Test every single key block with the keymeta tool in the backend
	for (let i = 0; i < blocksToScan.length; i++) {
		const currentItem = blocksToScan[i];
		const currentBlock = currentItem ? currentItem.text : '';
		if (!currentBlock) {
			continue;
		}

		// Save the current block to a quick temporary file
		const tmpFile = 'tmp_import_scan_' + i + '.pem';
		await rpcWriteFile(CFG.FILE.dir_keys + tmpFile, currentBlock + '\n');

		// Run keymeta to check if this key is good or bad
		const res = await luci_app_openvpn_plus([CFG.LIBEXEC.keymeta, tmpFile]);
		await rpcRemoveFile(CFG.FILE.dir_keys + tmpFile);
		const metaReport = res.toUpperCase();

		// Stop instantly if keymeta finds an error or trash text inside the file
		if (metaReport.length == 0 || metaReport.indexOf('ERROR') !== -1) {
			throw new Error(ICON.ERROR + TXT.ERROR.key_check_failed);
		}

		// SORTING: Place keys into correct variables using their real crypto type from keymeta
		if (isXmlSource === true && currentItem.type !== 'unknown') {
			// Trust the XML tags because keymeta verified that the content is good!
			if (currentItem.type === 'ca') { caContent = currentBlock; }
			else if (currentItem.type === 'cert') { certContent = currentBlock; }
			else if (currentItem.type === 'key') { keyContent = currentBlock; }
			else if (currentItem.type === 'tlscrypt-v2') { tlsCryptContent = currentBlock; }
		} else {
			// Sorting path for pure keys.crt files based on actual crypto traits
			if (metaReport.indexOf('AUTHORITY') !== -1 || metaReport.indexOf('CA:TRUE') !== -1) {
				caContent = currentBlock;
			}
			else if (metaReport.indexOf('STANDARD CERTIFICATE') !== -1 || metaReport.indexOf('PUBLIC-KEY') !== -1) {
				certContent = currentBlock;
			}
			else if ((metaReport.indexOf('PRIVATE-KEY') !== -1) || metaReport.indexOf('Private-Key') !== -1) {
				keyContent = currentBlock;
			}
			else if (metaReport.indexOf('TLSv2-Client-Key') !== -1) {
				tlsCryptContent = currentBlock;
			}
		}
	}

	// Safety check: Every profile needs at least a CA, a Cert, and a Private Key
	if (!caContent || !certContent || !keyContent) {
		throw new Error(ICON.ERROR + TXT.ERROR.invalid_file_parts_missing);
	}

	// tls check: warning if missing - stop if requested
	if (!tlsCryptContent) {
		if (!window.confirm(ICON.WARNING + TXT.WARNING.tls_security_warning + '\n\n' + TXT.WARNING.tls_not_in_profile + '\n\n' + TXT.WARNING.tls_proced_import_anyway)) {
			throw new Error(ICON.WARNING + TXT.WARNING.tls_missing);
		}
	}

	// Helper function to remove XML text tags before saving to disk
	const stripXmlTags = function (str) {
		return str.replace(/<\/?(ca|cert|key|tls-crypt)>/g, '').trim();
	};

	// Save clean, verified keys to the router folders in parallel
	await Promise.all([
		rpcWriteFile(CFG.FILE.dir_keys + 'ca_' + instanceId + '.crt', stripXmlTags(caContent) + '\n'),
		rpcWriteFile(CFG.FILE.dir_keys + 'client_' + instanceId + '.crt', stripXmlTags(certContent) + '\n'),
		rpcWriteFile(CFG.FILE.dir_keys + 'client_' + instanceId + '.key', stripXmlTags(keyContent) + '\n'),
		tlsCryptContent ? rpcWriteFile(CFG.FILE.dir_keys + 'client_' + instanceId + '.tls2.key', stripXmlTags(tlsCryptContent) + '\n') : Promise.resolve()
	]);

	// Look for connection data to choose between a full setup or key rotation
	const remoteServerMatch = content.match(/^remote\s+(\S+)\s+(\d+)/m);
	const remoteServerLanMatch = content.match(/^setenv\s+remotelan\s+([^\n]+)/m);
	const protoMatch = content.match(/^proto\s+(\S+)/m);
	const cnameMatch = content.match(/^setenv\s+client-cname\s+([^\n]+)/m);

	if (!remoteServerMatch) {
		return {
			isCryptoUpdateOnly: true,
			remoteServer: '',
			remoteServerLan: '',
			port: '',
			proto: '',
			cname: ''
		};
	}

	return {
		isCryptoUpdateOnly: false,
		remoteServer: remoteServerMatch[1].trim(),
		remoteServerLan: remoteServerLanMatch ? remoteServerLanMatch[1].trim() : '',
		port: parseInt(remoteServerMatch[2], 10) || OPENVPN.PORT.n1194,
		proto: protoMatch ? protoMatch[1].trim().toLowerCase() : OPENVPN.PROTO.UDP,
		cname: cnameMatch ? cnameMatch[1].trim() : ''
	};
};

/**
 * Displays the mobile QR code for OpenVPN profiles
 */
const renderClientOvpnProfileQr = function (containerNode, downloadUrl) {
	containerNode.innerHTML = '';

	if (typeof uqr !== 'undefined' && typeof uqr.renderSVG === 'function') {
		try {
			// Clean standard pixel size. Generates perfect native grid coordinates.
			const rawSvgString = uqr.renderSVG(downloadUrl, {
				ecc: 'M',
				pixelSize: 4,
				whiteColor: 'white',
				blackColor: 'black'
			});

			// Inject the raw SVG string straight into the elastic box
			containerNode.innerHTML = rawSvgString;

			// Remove any forced 100% stretching so the SVG stays at its true natural size
			const svgElement = containerNode.querySelector('svg');
			if (svgElement) {
				svgElement.style.display = 'block';
				svgElement.style.margin = '0 auto';
				svgElement.style.width = '';
				svgElement.style.height = '';
				svgElement.style.shapeRendering = 'crispEdges';
			}
		} catch (e) {
			console.error('Native uqr framework (QR-Code) execution failed:', e);
		}
	} else {
		containerNode.appendChild(E('div', { 'style': 'color:color-mix(in srgb, var(--text-color-medium, #71717a) 85%, #0055ff); font-size:12px; padding:20px;' }, [
			E('strong', {}, ICON.WARNING + TXT.WARNING.profile_link_without_qr_code)
		]));
	}
};

/**
 * Displays the mobile layout container for OpenVPN profiles
 */
const renderClientOvpnProfileModal = function (ipFieldWrapper, urlContainer, qrContainer, dlBtn, closeBtn) {
	return E('div', { 'class': 'cbi-map' }, [
		E('div', { 'class': 'cbi-section' }, [
			E('div', { 'class': 'cbi-section-descr', 'style': 'margin-bottom:15px; border-bottom:1px solid var(--border-color-medium, #cbd5e1); padding-bottom:8px;' },
				TXT.MSG.export_connection_address_qr_code
			),
			E('div', { 'style': 'display:flex; flex-direction:column; align-items:center; width:100%; text-align:center; margin-bottom:15px; background: var(--background-color-medium, #f4f4f5); padding:12px; border:1px solid var(--border-color-medium, #cbd5e1); border-radius:4px;' }, [
				E('strong', { 'style': 'display:block; font-size:12px; color:color-mix(in srgb, var(--text-color-medium, #71717a) 85%, #0055ff); text-transform:uppercase; letter-spacing:0.5px;' }, TXT.MSG.vpn_client_address),
				ipFieldWrapper
			]),
			E('div', { 'style': 'display:flex; flex-direction:column; align-items:center; gap:15px; background: var(--background-color-medium, #f4f4f5); padding:20px; border-radius:6px; border:1px solid var(--border-color-medium, #cbd5e1); margin-bottom:15px;' }, [
				E('div', { 'style': 'width:100%; text-align:center;' }, [
					E('strong', { 'style': 'display:block; margin-bottom:6px; font-size:12px; color:color-mix(in srgb, var(--text-color-medium, #71717a) 85%, #0055ff); text-transform:uppercase; letter-spacing:0.5px;' }, TXT.MSG.secure_temporary_profile_url),
					urlContainer
				]),
				E('div', { 'style': 'width:100%; text-align:center; margin-top:5px;' }, [
					E('strong', { 'style': 'display:block; margin-bottom:2px; font-size:12px; color:color-mix(in srgb, var(--text-color-medium, #71717a) 85%, #0055ff); text-transform:uppercase; letter-spacing:0.5px;' }, TXT.MSG.scan_qr_code_with_camera),
					qrContainer
				]),
				E('div', { 'style': 'width:100%; text-align:center; margin-top:8px; font-size:12px; color:color-mix(in srgb, var(--text-color-medium, #71717a) 85%, #0055ff); padding-top:10px; border-top:1px dashed var(--border-color-medium, #cbd5e1); font-weight:500;' }, [
					E('span', { 'style': 'var(--success-color-high, #00ac59); font-weight:bold; margin-right:4px;' }, ICON.WARNING + TXT.WARNING.security_notice + ' '),
					TXT.MSG.download_only_available_window_open
				])
			]),
			E('div', { 'style': 'text-align:right; border-top:1px solid var(--border-color-medium, #cbd5e1); padding-top:12px; margin-top:15px;' }, [
				dlBtn, E('span', { 'style': 'margin-right:10px;' }), closeBtn
			])
		])
	]);
};

/**
 * Creates the basic screen elements for the mobile QR window
 */
const createQrBoxElements = function (initialHost) {
	// Create the link field that users can click to open or download files
	const urlOutput = E('a', {
		'target': '_blank', 'download': '', 'onclick': 'event.stopPropagation();',
		'style': 'display:block; width:100%; font-family:var(--font-monospace, monospace); font-size:13px; color:var(--primary-color-high, #1976d2); font-weight:bold; text-align:center; text-decoration:underline; padding:8px; background:var(--background-color-medium, #f4f4f5); border:1px dashed var(--border-color-medium, #cbd5e1); border-radius:4px; word-break:break-all;'
	}, ['']);

	// Create a clean white card box that changes its size automatically
	const qrContainer = E('div', {
		'style': 'text-align:center; padding:12px; background:var(--background-color-high); border:1px solid var(--border-color-medium, #cbd5e1); border-radius:6px; display:inline-block; box-sizing:border-box; width:auto; height:auto; min-width:140px; min-height:140px; box-shadow:0 1px 3px rgba(0,0,0,0.05); margin-top:5px;'
	}, [E('em', {}, TXT.BTN.generating)]);

	const dlBtn = E('button', { 'class': 'cbi-button cbi-button-action important' }, ICON.SAVE + TXT.BTN.download_ovpn);
	const closeBtn = E('button', { 'class': 'cbi-button cbi-button-neutral' }, TXT.BTN.close);

	const labelNode = E('span', { 'style': 'font-weight:bold; font-size:15px; margin-right:15px;' }, [initialHost]);
	const inputNode = E('input', { 'type': 'text', 'class': 'cbi-input-text', 'value': initialHost, 'style': 'display:none; width:180px; font-weight:bold; font-size:13px; text-align:center; padding:4px;' });
	const editBtn = E('button', { 'class': 'cbi-button cbi-button-neutral', 'style': 'padding:2px 10px; font-size:11px;' }, [ICON.CHANGE + TXT.BTN.change]);

	const ipWrapper = E('div', { 'style': 'display:flex; flex-direction:row; align-items:center; justify-content:center; width:100%; margin-top:5px;' }, [labelNode, inputNode, editBtn]);

	return {
		nodes: { url: urlOutput, qr: qrContainer, label: labelNode, input: inputNode, edit: editBtn, wrapper: ipWrapper },
		buttons: { download: dlBtn, close: closeBtn }
	};
};

/**
 * Setup all click actions and update the view when things change
 */
const setupQrBoxEvents = function (elements, ovpnParams, cryptoAssets, appData, isSiteToSite) {

	// Update data, links and the QR code asynchronously when the host changes
	const refreshModalState = async function () {
		try {
			const activeHost = elements.nodes.input.value ? sanitizeInputLine(elements.nodes.input.value) : window.location.hostname;
			const instNumber = appData.statusClass.getInstanceNumber(ovpnParams.nextId);

			// 1. Await the dynamic profile compilation text block
			const fullProfileText = await compileOvpnProfileText(ovpnParams.displayId, activeHost, ovpnParams.port, ovpnParams.proto, cryptoAssets, appData, instNumber, isSiteToSite);
			const sanitizedFileName = ovpnParams.displayId.replace(/\s+/g, '_');
			const downloadUrl = window.location.protocol + '//' + window.location.host + '/' + sanitizedFileName + '_client.ovpn';

			elements.nodes.url.href = downloadUrl;
			elements.nodes.url.textContent = downloadUrl;

			// 2. Write the compiled text payload directly into the RAM configuration folder
			await rpcWriteFile(ovpnParams.exportPath, fullProfileText);

			// 3. Trigger the backend symlink engine execution pipeline
			await luci_app_openvpn_plus([CFG.LIBEXEC.symlink, instNumber.toString(), 'create', ovpnParams.displayId]);

			// 4. Render the vector graphic directly into the visible workspace panel
			renderClientOvpnProfileQr(elements.nodes.qr, downloadUrl);

		} catch (e) {
			console.error('Failed to process and link profile export assets:', e);
		}
	};

	elements.nodes.input.addEventListener('input', refreshModalState);

	// Show or hide the text input box when clicking the change button
	elements.nodes.edit.addEventListener('click', function (ev) {
		ev.preventDefault();
		if (elements.nodes.input.style.display === 'none') {
			elements.nodes.label.style.display = 'none';
			elements.nodes.input.style.display = 'inline-block';
			elements.nodes.input.focus();
			elements.nodes.edit.textContent = TXT.BTN.ok;
			elements.nodes.edit.className = 'cbi-button cbi-button-action important';
		} else {
			const typedVal = sanitizeInputLine(elements.nodes.input.value);
			const activeMutationHost = typedVal || window.location.hostname;
			elements.nodes.label.textContent = activeMutationHost;

			elements.nodes.input.style.display = 'none';
			elements.nodes.label.style.display = 'inline-block';
			elements.nodes.edit.textContent = ICON.CHANGE + TXT.BTN.change;
			elements.nodes.edit.className = 'cbi-button cbi-button-neutral';

			refreshModalState();
		}
	});

	// Download the profile file directly to a computer
	elements.buttons.download.addEventListener('click', function () {
		const activeHost = elements.nodes.input.value ? sanitizeInputLine(elements.nodes.input.value) : window.location.hostname;
		const instNumber = appData.statusClass.getInstanceNumber(ovpnParams.nextId);
		compileOvpnProfileText(ovpnParams.displayId, activeHost, ovpnParams.port, ovpnParams.proto, cryptoAssets, appData, instNumber, isSiteToSite).then(function (fullProfileText) {
			const blob = new Blob([fullProfileText], { type: 'application/x-openvpn-profile' });
			const link = document.createElement('a');
			link.href = URL.createObjectURL(blob);
			link.download = ovpnParams.displayId.replace(/\s+/g, '_') + '_client.ovpn';
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
		});
	});

	// Delete temporary files and close the window when clicking the close button
	elements.buttons.close.addEventListener('click', async function () {
		const instNumber = appData.statusClass.getInstanceNumber(ovpnParams.nextId);
		try {
			// 1. Remove the temporary export file
			await rpcRemoveFile(ovpnParams.exportPath);
			// 2. Call the universal script to delete the symlink
			await luci_app_openvpn_plus([CFG.LIBEXEC.symlink, instNumber.toString(), 'delete', ovpnParams.displayId]);
		} catch (err) {
			// Log the error but do not block the UI from closing
			console.error("Error during cleanup:", err);
		} finally {
			// 3. Always hide the modal window and trigger save/apply if needed
			L.ui.hideModal();
			if (ovpnParams.saveApplyOpenVPN === true) {
				uciSaveApplyRestart(ovpnParams.instance_id);
			}
		}
	});

	// Run the first update when the view loads
	refreshModalState();
};

/**
 * Universal data structure template for packing generated OpenVPN profile assets
 */
const SERVER_FILES_TEMPLATE = {
	conf: '',
	ca: '',
	cert: '',
	key: '',
	tlsCrypt: ''
};

/**
 * Opens a simplified modal for mobile apps clients with a dynamic targetCnName input field and triggers asynchronous client cryptographic generation.
 */
const openMobileExportModal = function (instance_id, nextId, files, finalHost, triggerStandardExportFlow, appData) {
	const cnInput = E('input', {
		'type': 'text',
		'class': 'cbi-input-text',
		'style': 'width:100%; font-weight:bold;',
		'placeholder': TXT.MSG.placeholder_cn_mobile
	});
	cnInput.addEventListener('input', function () {
		cnInput.classList.remove('cbi-input-invalid');
	});
	const modalConfirmBtn = E('button', { 'class': 'cbi-button cbi-button-action important' }, [TXT.BTN.next + ' ' + ICON.ARROW]);
	const modalCancelBtn = E('button', { 'class': 'cbi-button cbi-button-neutral', 'style': 'margin-right:10px;' }, [TXT.BTN.cancel]);
	const statusFeedbackNode = E('textarea', {
		'class': 'cbi-input-textarea',
		'style': 'width:100%; max-width:100%; resize:none; font-family:monospace; font-size:11px; display:none; background:#18181b; color:#4ade80; padding:10px; margin-top:12px;',
		'rows': '8', 'readonly': 'readonly'
	});
	let forgedAssetsBundle = null;
	let finalizedCnName = '';
	let saveApplyOpenVPN = false;

	L.ui.showModal(ICON.MOBILE + ' ' + TXT.MSG.export_openvpn_connect_client_profile, [
		E('div', { 'class': 'cbi-map' }, [
			E('div', { 'class': 'cbi-section' }, [
				E('div', { 'id': 'mobile-description-node', 'class': 'cbi-section-descr', 'style': 'margin-bottom:12px; font-size:12px; color:color-mix(in srgb, var(--text-color-medium, #71717a) 85%, #0055ff);' }, [
					TXT.MSG.please_assign_cn_name
				]),
				E('div', { 'class': 'cbi-value', 'style': 'border:none; padding:0;' }, [
					E('div', { 'class': 'cbi-value-field', 'style': 'width:100%; margin:0; padding:0;' }, [
						cnInput,
						statusFeedbackNode
					])
				]),
				E('div', { 'style': 'text-align:right; margin-top:15px; border-top:1px solid var(--border-color-medium, #cbd5e1); padding-top:12px;' }, [
					modalCancelBtn, modalConfirmBtn
				])
			])
		])
	]);
	modalCancelBtn.addEventListener('click', L.ui.hideModal);

	modalConfirmBtn.addEventListener('click', function (ev) {
		ev.preventDefault();
		if (forgedAssetsBundle && finalizedCnName) {
			L.ui.hideModal();
			triggerStandardExportFlow(forgedAssetsBundle, finalizedCnName, saveApplyOpenVPN);
			return;
		}
		cnInput.classList.remove('cbi-input-invalid');
		const rawCn = sanitizeInputLine(cnInput.value);
		const cleanCn = appData.wizardClass.getValidCommonName(rawCn);
		if (!rawCn || !cleanCn) {
			cnInput.classList.add('cbi-input-invalid');
			return;
		}
		finalizedCnName = cleanCn;
		const descNode = document.getElementById('mobile-description-node');
		if (descNode) { descNode.style.display = 'none'; }
		cnInput.style.display = 'none';
		modalConfirmBtn.disabled = true;
		modalConfirmBtn.textContent = ICON.LOADING + ' ' + TXT.BTN.processing;
		modalCancelBtn.style.display = 'none';
		statusFeedbackNode.style.display = 'block';

		// Step 1: Run the standard Asynchronous Client Certificate generation pipeline
		appData.keygenClass.executeAsynchronousKeyGen(nextId, appData.keygenClass.KEYTYPE.client_pki, appData.keygenClass.KEYTYPE.rsa2048_ec, appData.keygenClass.KEYTYPE.y100, finalizedCnName, '', statusFeedbackNode, rpcFileCallbacks, function (keygenSuccess, pkiPayload) {
			if (!keygenSuccess || !pkiPayload) {
				modalCancelBtn.style.display = 'inline-block';
				modalConfirmBtn.disabled = false;
				modalConfirmBtn.textContent = TXT.BTN.next + ' ' + ICON.ARROW;
				statusFeedbackNode.value += '\n' + ICON.ERROR + ' ' + TXT.ERROR.keygen_failed;
				return;
			}
			statusFeedbackNode.value += '\nLOG: Certificate pipeline completed. Generating TLS crypt v2 client key...';

			// Step 2: Directly chain the asymmetric client tls generation
			appData.keygenClass.executeAsynchronousKeyGen(nextId, appData.keygenClass.KEYTYPE.client_tls2, 'none', '0', finalizedCnName, '', statusFeedbackNode, rpcFileCallbacks, function (tlsSuccess, nullData, tlsPayload) {
				if (!tlsSuccess || !tlsPayload) {
					modalCancelBtn.style.display = 'inline-block';
					modalConfirmBtn.disabled = false;
					modalConfirmBtn.textContent = TXT.BTN.next + ' ' + ICON.ARROW;
					statusFeedbackNode.value += '\n' + ICON.ERROR + ' TLS crypt v2 client key generation failed.';
					return;
				}

				// Pack all 5 crypto components cleanly into the finalized delivery bundle
				forgedAssetsBundle = Object.assign({}, SERVER_FILES_TEMPLATE, {
					conf: files.conf,
					ca: pkiPayload.ca,
					cert: pkiPayload.cert,
					key: pkiPayload.key,
					tlsCrypt: tlsPayload
				});
				modalConfirmBtn.disabled = false;
				modalConfirmBtn.className = 'cbi-button cbi-button-action important';
				modalConfirmBtn.textContent = TXT.INFO.export_profile + '\u00A0\u00A0\u00A0' + ICON.DOWNLOAD;

			}, 'append');
		}, 'fresh');
	});
};

/**
 * Update or delete the clients on a site-to-site export config file
 */
const siteToSiteExportUpdateClients = async function (instance_id, nextId, targetCnName, targetSub, targetMask) {
	// Read the current configuration file from disk memory
	const currentConfigText = await rpcReadFile(CFG.FILE.dir_cfg + nextId + '.conf');
	const lines = currentConfigText ? currentConfigText.split('\n') : [];

	// Create an empty array to collect all clean existing offices
	let collectedOffices = [];

	// Regular expressions to find office names and real networks inside the file lines
	const cnameRegex = /setenv\s+CLIENT_CNAME_(\d+)\s+"([^"]+)"/;
	const realNetRegex = /setenv\s+CLIENT_ROUTE_\d+\s+"i?route(?:-ipv6)?\s+([^\s"]+)(?:\s+([^\s"]+))?"/;

	const isArrayInput = Array.isArray(targetCnName);

	// STEP A: Loop through all lines to find CLIENT_CNAME and their index numbers
	for (let l = 0; l < lines.length; l++) {
		const line = lines[l].trim();
		const cnameMatch = line.match(cnameRegex);
		if (cnameMatch) {
			const currentNum = cnameMatch[1]; // The X inside CLIENT_CNAME_X
			const currentName = cnameMatch[2].trim(); // The actual office name string
			if (currentName) {
				collectedOffices.push({
					num: currentNum,
					commonName: currentName,
					fullRealNet: ''
				});
			}
		}
	}

	// STEP B: Loop through our found offices and find the matching CLIENT_ROUTE anywhere in the text
	collectedOffices.forEach(function (office) {
		for (let i = 0; i < lines.length; i++) {
			if (lines[i].indexOf('CLIENT_ROUTE_' + office.num) !== -1) {
				const netMatch = lines[i].match(realNetRegex);
				if (netMatch) {
					// Reconstruct the network identifier string safely for both IPv4 and IPv6
					office.fullRealNet = netMatch[1] + (netMatch[2] ? ' ' + netMatch[2] : '');
					break;
				}
			}
		}
	});

	// STEP C: Filter out all offices that do not have both a name and a network string
	collectedOffices = collectedOffices.filter(function (office) {
		return office.commonName && office.fullRealNet;
	});

	// STEP D: Handle Array Input (DELETE Mode) or String Input (ADD Mode)
	if (isArrayInput === true) {
		// Convert all target names to lowercase for safe matching
		const lowercaseTargets = targetCnName.map(function (name) {
			return name.toLowerCase();
		});

		// Filter out the offices that match any name inside our deletion array
		collectedOffices = collectedOffices.filter(function (office) {
			return lowercaseTargets.indexOf(office.commonName.toLowerCase()) === -1;
		});
	} else {
		// Standard path: Push the new office straight into our collection array
		collectedOffices.push({
			num: '',
			commonName: targetCnName,
			fullRealNet: (targetSub.indexOf(':') !== -1) ? (targetSub + '/' + (targetMask || '64')) : (targetSub + ' ' + targetMask)
		});
	}

	// Create an empty array for the clean base server configuration lines
	const cleanedLines = [];

	// Setup state flags for our placeholder positioning markers
	let systemRouteFound = false;
	let clientEnvFound = false;

	const system_route_marker = 'system_route_marker';
	const client_env_marker = 'client_env_marker';

	// Loop through all lines, strip old dynamic entries and place strategic markers
	for (let l = 0; l < lines.length; l++) {
		const currentLineTrimmed = lines[l].trim();

		// Check for the very first naked system route line to insert our marker
		if ((currentLineTrimmed.indexOf('route ') === 0 || currentLineTrimmed.indexOf('route-ipv6 ') === 0) && currentLineTrimmed.indexOf('push') === -1 && !systemRouteFound) {
			systemRouteFound = true;
			cleanedLines.push(system_route_marker);
			continue;
		}

		// Check for the very first client environment line to insert our marker
		if (currentLineTrimmed.indexOf(CFG.CONF.setenv_client_cname_) === 0 && !clientEnvFound) {
			clientEnvFound = true;
			cleanedLines.push(client_env_marker);
			continue;
		}

		// ONLY skip the explicit dynamic blocks to clean up old data entries
		if ((currentLineTrimmed.indexOf('route ') === 0 && currentLineTrimmed.indexOf('push') === -1) ||
			currentLineTrimmed.indexOf('route-ipv6 ') === 0 ||
			currentLineTrimmed.indexOf(CFG.CONF.setenv_client_cname_) === 0 ||
			currentLineTrimmed.indexOf(CFG.CONF.setenv_client_route_) === 0) {
			continue;
		}

		// Fallback Section: If no active code line was found yet, check for comment headers as anchors
		if (!systemRouteFound && currentLineTrimmed.indexOf(CFG.CONF.sitetosite_add_routes_comment) === 0) {
			systemRouteFound = true;
			cleanedLines.push(lines[l]);
			cleanedLines.push(system_route_marker);
			continue;
		}

		if (!clientEnvFound && currentLineTrimmed.indexOf(CFG.CONF.sitetosite_setenv_cname_comment) === 0) {
			clientEnvFound = true;
			cleanedLines.push(lines[l]);
			cleanedLines.push(client_env_marker);
			continue;
		}

		// Keep all other code lines, comments and empty spaces completely untouched
		cleanedLines.push(lines[l]);
	}

	let dynamicRouteBlock = '';
	let dynamicEnvBlock = '';

	// Loop through our clean array and build the new text lines sequentially from 1 to N
	collectedOffices.forEach(function (office, index) {
		const num = index + 1;
		const isIpv6 = (office.fullRealNet.indexOf(':') !== -1);

		if (isIpv6 === true) {
			// IPv6 Dual-Stack Configuration Commands
			dynamicRouteBlock += 'route-ipv6 ' + office.fullRealNet + '\n';
			dynamicEnvBlock += CFG.CONF.setenv_client_cname_ + num + ' "' + office.commonName + '"\n' +
				CFG.CONF.setenv_client_route_ + num + ' "iroute-ipv6 ' + office.fullRealNet + '"\n';
		} else {
			// Standard IPv4 Configuration Commands
			dynamicRouteBlock += 'route ' + office.fullRealNet + '\n';
			dynamicEnvBlock += CFG.CONF.setenv_client_cname_ + num + ' "' + office.commonName + '"\n' +
				CFG.CONF.setenv_client_route_ + num + ' "iroute ' + office.fullRealNet + '"\n';
		}
	});

	let configOutput = cleanedLines.join('\n');

	// Inject the dynamic blocks into the markers
	if (systemRouteFound === true) {
		configOutput = configOutput.replace(system_route_marker, dynamicRouteBlock.trim());
	} else if (dynamicRouteBlock) {
		configOutput = dynamicRouteBlock + '\n' + configOutput;
	}

	if (clientEnvFound === true) {
		configOutput = configOutput.replace(client_env_marker, dynamicEnvBlock.trim());
	} else if (dynamicEnvBlock) {
		configOutput = dynamicEnvBlock + '\n' + dynamicEnvBlock;
	}

	// Clean up any remaining hanging system markers safely
	configOutput = configOutput.replace(system_route_marker, '').replace(client_env_marker, '');

	// Write the new configuration file back to disk storage memory
	await rpcWriteFile(CFG.FILE.dir_cfg + instance_id + '.conf', formatOpenVpnConfig(configOutput));
};


/**
 * Opens the selection modal for site-to-site clients and handles configuration updates
 */
const openSiteToSiteExportModal = function (instance_id, nextId, files, activeBranchNames, initialHost, triggerStandardExportFlow, appData) {

	const selectDropdown = E('select', { 'class': 'cbi-input-select', 'style': 'width:100%; font-weight:bold;' });
	activeBranchNames.forEach(function (name) {
		selectDropdown.appendChild(E('option', { 'value': name }, [ICON.OFFICE + TXT.MSG.office_profile + ' ' + name]));
	});
	selectDropdown.appendChild(E('option', { 'value': 'create_new_client' }, [ICON.PLUS + TXT.KEY.create_key_new_office]));
	selectDropdown.appendChild(E('option', { 'value': 'delete_existing_clients' }, [ICON.MINUS + _('Delete Client Profile...')]));

	const subnetInputs = appData.wizardClass.renderSubnetInputs();

	// Creates a hidden yellowish warning message box for network conflicts or duplicate names
	const errorDisplayNode = E('div', {
		'style': 'display:none; margin-top:10px; margin-bottom:10px; padding:5px; background:color-mix(in srgb, var(--warn-color-high, #efbd0b) 18%, transparent); border-left:4px solid var(--warn-color-high, #efbd0b); font-family:var(--font-monospace, monospace); line-height:1.6; font-weight:bold; font-size:13px; text-align:center; border-radius:4px;'
	});

	// Create Add and Delete buttons
	const addOfficeBtn = E('button', { 'class': 'cbi-button cbi-button-add', 'style': 'margin-top:8px; font-weight:bold;' }, [ICON.PLUS + _('Add')]);
	const delOfficeBtn = E('button', { 'class': 'cbi-button cbi-button-remove disabled', 'style': 'margin-top:8px; font-weight:bold; text-align: right; display: none;', 'disabled': true }, [ICON.REMOVE + _('Delete')]);

	// Creates a small preview table to show the validated network data
	const networkPreviewTable = E('table', {
		'style': 'display:none; width:auto; border-spacing:10px 2px; font-size:11px; margin-top:4px; text-align:left; border:0; background:transparent;'
	}, [
		E('tr', {}, [
			E('th', { 'style': 'padding:0 5px; color:var(--text-color-medium, #71717a); font-weight:bold;' }, [TXT.INFO.remote_name]),
			E('th', { 'style': 'padding:0 5px; color:var(--text-color-medium, #71717a); font-weight:bold;' }, [TXT.INFO.remote_lan_subnet]),
			E('th', { 'style': 'padding:0 5px; color:var(--text-color-medium, #71717a); font-weight:bold;' }, [TXT.INFO.netmask])
		]),
		E('tr', { 'style': 'font-family:monospace; font-weight:bold;' }, [
			E('td', { 'id': 'preview_name', 'style': 'padding:0 5px;' }, ['-']),
			E('td', { 'id': 'preview_subnet', 'style': 'padding:0 5px;' }, ['-']),
			E('td', { 'id': 'preview_mask', 'style': 'padding:0 5px;' }, ['-'])
		])
	]);

	// Combines the preview table and buttons into a flexible space-between row
	const flexBtnContainer = E('div', { 'style': 'display:flex; justify-content: space-between; align-items: flex-end; width:100%;' }, [
		addOfficeBtn,
		networkPreviewTable,
		delOfficeBtn
	]);


	// Combine input fields, buttons and error box into one container
	const inputRowContainer = E('div', { 'style': 'margin-top:4px; display:none;' }, [
		subnetInputs.node,
		flexBtnContainer,
		errorDisplayNode
	]);

	// Create an independent checklist container for picking branches to delete
	const deleteChecklistContainer = E('div', {
		'style': 'margin-top:12px; padding:15px; background:var(--background-color-medium, #f4f4f5); border:1px dashed var(--border-color-medium, #f4f4f5); border-radius:4px; width:100%; display: none;'
	}, [
		E('strong', { 'style': 'display:block; margin-bottom:10px; font-size:12px; color:var(--error-color-high, #f62b12); text-transform:uppercase; font-family:var(--font-sans);' }, [_('Select clients to remove:')])
	]);

	// Generate dynamic matrix layout checklist row objects inside the memory tree
	const checkboxElementsArray = [];
	activeBranchNames.forEach(function (branchName) {
		const uniqueCheckboxId = 'del_target_' + branchName.replace(/[^a-zA-Z0-9]/g, '_');
		const checkboxInput = E('input', {
			'type': 'checkbox',
			'id': uniqueCheckboxId,
			'value': branchName,
			'style': 'width:18px; height:18px; margin:0; cursor:pointer;'
		});

		// Monitor checkboxes live to block or unlock the master confirm execution tracking button
		checkboxInput.addEventListener('change', function () {
			const hasSelection = checkboxElementsArray.some(function (cb) {
				return cb.checked;
			});
			modalConfirmBtn.disabled = !hasSelection;
		});

		checkboxElementsArray.push(checkboxInput);

		deleteChecklistContainer.appendChild(E('label', {
			'for': uniqueCheckboxId,
			'style': 'display:flex; align-items:center; gap:10px; margin-bottom:8px; padding:6px; background:var(--background-color-medium, #f4f4f5); border-radius:3px; cursor:pointer; font-weight:bold;'
		}, [
			checkboxInput,
			E('span', { 'style': 'font-family:monospace;' }, [ICON.OFFICE + branchName])
		]));
	});

	if (activeBranchNames.length === 0) {
		selectDropdown.value = 'create_new_client';
		inputRowContainer.style.display = 'block';
	}

	// Handle dropdown visibility and button state changes
	selectDropdown.addEventListener('change', function (e) {
		if (e.target.value === 'create_new_client') {
			inputRowContainer.style.display = 'block';
			deleteChecklistContainer.style.display = 'none';
			// Use delete click logic to trigger an initial data reset
			delOfficeBtnClick();
			modalConfirmBtn.disabled = true;
		} else if (e.target.value === 'delete_existing_clients') {
			inputRowContainer.style.display = 'none';
			errorDisplayNode.style.display = 'none';
			deleteChecklistContainer.style.display = 'block';
			// Check if any deletion check item is already selected
			const hasAnySelection = checkboxElementsArray.some(function (cb) {
				return cb.checked;
			});
			modalConfirmBtn.disabled = !hasAnySelection;
		} else {
			inputRowContainer.style.display = 'none';
			deleteChecklistContainer.style.display = 'none';
			errorDisplayNode.style.display = 'none';
			modalConfirmBtn.disabled = false;
		}
	});

	const modalConfirmBtn = E('button', { 'class': 'cbi-button cbi-button-action important' }, [TXT.BTN.next + ' ' + ICON.ARROW]);
	const modalCancelBtn = E('button', { 'class': 'cbi-button cbi-button-neutral', 'style': 'margin-right:10px;' }, [TXT.BTN.cancel]);
	const statusFeedbackNode = E('textarea', {
		'class': 'cbi-input-textarea',
		'style': 'width:100%; max-width:100%; resize:none; font-family:monospace; font-size:11px; display:none; background:#18181b; color:#4ade80; padding:10px; margin-top:12px;',
		'rows': '8', 'readonly': 'readonly'
	});

	if (selectDropdown.value === 'create_new_client' || selectDropdown.value === 'delete_existing_clients') {
		modalConfirmBtn.disabled = true;
	}

	let localCachedValidatedNetwork = null;
	let forgedAssetsBundle = null;
	let finalizedCnName = '';
	let saveApplyOpenVPN = false;

	// Action for the Add button - validates inputs, checks for duplicates, and checks router subnets
	addOfficeBtn.addEventListener('click', function (ev) {
		ev.preventDefault();
		errorDisplayNode.style.display = 'none';

		const validatedNetworkData = subnetInputs.validateAndFetchData();
		if (!validatedNetworkData) {
			return;
		}

		// Check if the office name already exists in activeBranchNames
		const isDuplicateCN = activeBranchNames.some(function (name) {
			return name.toLowerCase() === validatedNetworkData.commonName.toLowerCase();
		});

		let isDuplicateSubnet = false;
		appData.instances.forEach(function (inst) {
			if (inst.id == instance_id) {
				inst.remoteSubnets.forEach(function (subnet) {
					if (subnet.indexOf(validatedNetworkData.subnet) !== -1) {
						isDuplicateSubnet = true;
						return;
					}
				});
				return;
			}
		});

		if (isDuplicateCN || isDuplicateSubnet) {
			errorDisplayNode.innerHTML = ICON.WARNING + ' ' + (isDuplicateCN ? TXT.ERROR.office_name_already_exist : TXT.ERROR.ip_used_on_other_office)
			errorDisplayNode.style.display = 'block';
			subnetInputs.fields.cn.classList.add('cbi-input-invalid');
			subnetInputs.fields.cn.focus();
			return;
		}

		// Call the system network check to prevent local subnet collisions
		checkNetworkStructure(appData).then(function (networkState) {
			const blockedSubnets = networkState.localSubnets || [];

			// Check if input matches any local LAN or WAN network range
			let invalidSubNet = false;
			blockedSubnets.forEach(function (subnet) {
				if (subnet.indexOf(validatedNetworkData.subnet) !== -1) {
					errorDisplayNode.innerHTML = ICON.WARNING + ' ' + TXT.ERROR.use_local_ipnetwork;
					errorDisplayNode.style.display = 'block';
					subnetInputs.fields.sub.classList.add('cbi-input-invalid');
					subnetInputs.fields.sub.focus();
					invalidSubNet = true;
					return;
				}
			});
			if (invalidSubNet == true) {
				return;
			}

			// Save validated data to variable and freeze inputs
			localCachedValidatedNetwork = validatedNetworkData;

			// Write the validated values into our table preview cells
			flexBtnContainer.querySelector('#preview_name').textContent = validatedNetworkData.commonName;
			flexBtnContainer.querySelector('#preview_subnet').textContent = validatedNetworkData.subnet;
			flexBtnContainer.querySelector('#preview_mask').textContent = validatedNetworkData.mask;

			subnetInputs.fields.cn.disabled = true;
			subnetInputs.fields.sub.disabled = true;
			subnetInputs.fields.mask.disabled = true;

			// Show the preview table, hide Add button, and display Delete button on the right
			addOfficeBtn.style.display = 'none';
			networkPreviewTable.style.display = 'table';
			delOfficeBtn.disabled = false;
			delOfficeBtn.classList.remove('disabled');
			delOfficeBtn.style.display = 'block';

			// Unlock the main Next button
			modalConfirmBtn.disabled = false;
		}).catch(function () {
			errorDisplayNode.innerHTML = ICON.WARNING + ' ' + _('Error: Network status check failed.');
			errorDisplayNode.style.display = 'block';
		});
	});

	// Master helper function to clean errors, clear text fields, and reset button styles
	const delOfficeBtnClick = function () {
		localCachedValidatedNetwork = null;
		errorDisplayNode.style.display = 'none';
		subnetInputs.clearErrors();

		// Unlock and clear input text boxes
		subnetInputs.fields.cn.disabled = false;
		subnetInputs.fields.sub.disabled = false;
		subnetInputs.fields.mask.disabled = false;
		subnetInputs.fields.cn.value = '';
		subnetInputs.fields.sub.value = '';
		subnetInputs.fields.mask.value = '';

		// Reset button container layout and visibilities
		networkPreviewTable.style.display = 'none';
		addOfficeBtn.style.display = 'block';
		addOfficeBtn.disabled = false;
		addOfficeBtn.classList.remove('disabled');
		delOfficeBtn.disabled = true;
		delOfficeBtn.classList.add('disabled');
		delOfficeBtn.style.display = 'none';

		// Lock the main Next button again
		modalConfirmBtn.disabled = true;
		subnetInputs.fields.cn.focus();
	};

	// Action for the Delete button - clears data, unlocks inputs and resets button states
	delOfficeBtn.addEventListener('click', function (ev) {
		ev.preventDefault();
		delOfficeBtnClick();
	});

	L.ui.showModal(ICON.ROUTING + TXT.MSG.lan_to_lan_profile_selection, [
		E('div', { 'class': 'cbi-map' }, [
			E('div', { 'class': 'cbi-section' }, [
				E('div', { 'id': 's2s-description-node', 'class': 'cbi-section-descr', 'style': 'margin-bottom:12px; font-size:12px; color:color-mix(in srgb, var(--text-color-medium, #71717a) 85%, #0055ff);' }, [
					TXT.MSG.select_remote_office_to_export
				]),
				E('div', { 'class': 'cbi-value' }, [
					E('div', { 'class': 'cbi-value-field', 'style': 'width:100%; margin:0; padding:0;' }, [
						selectDropdown,
						inputRowContainer,
						deleteChecklistContainer,
						statusFeedbackNode
					])
				]),
				E('div', { 'style': 'text-align:right; margin-top:15px; border-top:1px solid var(--border-color-medium, #cbd5e1); padding-top:12px;' }, [
					modalCancelBtn, modalConfirmBtn
				])
			])
		])
	]);

	modalCancelBtn.addEventListener('click', L.ui.hideModal);

	modalConfirmBtn.addEventListener('click', function (ev) {
		ev.preventDefault();
		if (forgedAssetsBundle && finalizedCnName) {
			L.ui.hideModal();
			triggerStandardExportFlow(forgedAssetsBundle, finalizedCnName, saveApplyOpenVPN);
			return;
		}

		const targetMode = selectDropdown.value;
		let targetCnName = '';
		let targetSub = '';
		let targetMask = '';
		let isNewClient = false;
		const isDeleteRoute = (targetMode === 'delete_existing_clients');

		// PATH A: DIRECT RE-ROUTING IF DELETE CLIENT IS SELECTED
		if (isDeleteRoute === true) {
			const selectedDeleteTargetsArray = [];
			checkboxElementsArray.forEach(function (cb) {
				if (cb.checked && cb.value) {
					selectedDeleteTargetsArray.push(cb.value);
				}
			});

			// Extra safety guard: abort if no checkbox items are marked
			if (selectedDeleteTargetsArray.length === 0) {
				return;
			}

			// Call update clients script directly using the collected deletion array list
			L.ui.hideModal();
			siteToSiteExportUpdateClients(instance_id, nextId, selectedDeleteTargetsArray, '', '');
			uciSaveApplyRestart(instance_id);
			return;
		}

		// PATH B: STANDARD CODE TRACK FOR CREATION AND EXPORT
		if (targetMode === 'create_new_client') {
			if (!localCachedValidatedNetwork) {
				return;
			}
			targetCnName = localCachedValidatedNetwork.commonName;
			targetSub = localCachedValidatedNetwork.subnet;
			targetMask = localCachedValidatedNetwork.mask;
			isNewClient = true;
		} else {
			targetCnName = targetMode;
		}

		finalizedCnName = targetCnName;
		const descNode = document.getElementById('s2s-description-node');
		if (descNode) {
			descNode.style.display = 'none';
		}
		selectDropdown.style.display = 'none';
		inputRowContainer.style.display = 'none';
		modalConfirmBtn.disabled = true;
		modalConfirmBtn.textContent = ICON.LOADING + ' ' + TXT.BTN.processing;
		modalCancelBtn.style.display = 'none';
		statusFeedbackNode.style.display = 'block';

		// Step 1: Execute standard client certificate generation pipeline
		appData.keygenClass.executeAsynchronousKeyGen(nextId, appData.keygenClass.KEYTYPE.client_pki, appData.keygenClass.KEYTYPE.rsa2048_ec, appData.keygenClass.KEYTYPE.y100, targetCnName, '', statusFeedbackNode, rpcFileCallbacks, async function (keygenSuccess, pkiPayload, nullData) {
			if (!keygenSuccess || !pkiPayload) {
				modalCancelBtn.style.display = 'inline-block';
				modalConfirmBtn.disabled = false;
				modalConfirmBtn.textContent = TXT.BTN.next + ' ' + ICON.ARROW;
				statusFeedbackNode.value += '\n' + ICON.ERROR + ' ' + TXT.ERROR.keygen_failed;
				return;
			}
			statusFeedbackNode.value += '\nLOG: Certificate pipeline completed. Generating TLS crypt v2 client key...';

			// Step 2: Directly chain the asymmetric client tls generation
			appData.keygenClass.executeAsynchronousKeyGen(nextId, appData.keygenClass.KEYTYPE.client_tls2, 'none', '0', targetCnName, '', statusFeedbackNode, rpcFileCallbacks, async function (tlsSuccess, nullData, tlsPayload) {
				if (!tlsSuccess || !tlsPayload) {
					modalCancelBtn.style.display = 'inline-block';
					modalConfirmBtn.disabled = false;
					modalConfirmBtn.textContent = TXT.BTN.next + ' ' + ICON.ARROW;
					statusFeedbackNode.value += '\n' + ICON.ERROR + ' TLS crypt v2 client key generation failed.';
					return;
				}
				const activeConfigContentText = files;
				if (isNewClient === true) {
					await siteToSiteExportUpdateClients(instance_id, nextId, targetCnName, targetSub, targetMask);
					saveApplyOpenVPN = true;
				}
				forgedAssetsBundle = Object.assign({}, SERVER_FILES_TEMPLATE, {
					conf: activeConfigContentText.conf,
					ca: pkiPayload.ca,
					cert: pkiPayload.cert,
					key: pkiPayload.key,
					tlsCrypt: tlsPayload
				});
				modalConfirmBtn.disabled = false;
				modalConfirmBtn.className = 'cbi-button cbi-button-action important';
				modalConfirmBtn.textContent = TXT.INFO.export_profile + '\u00A0\u00A0\u00A0' + ICON.DOWNLOAD;
			}, 'append');
		}, 'fresh');
	});
};

/**
 * Exporter for OpenVPN profiles with embedded client crypto data
 */
const downloadClientOvpnProfile = async function (instance_id, instObj, customUciName, appData) {
	const nextId = instance_id;
	const displayId = customUciName || instance_id;
	const currentRole = instObj.role || 'client';
	const rolePrefix = currentRole + '_';

	// Note: Profile will be compiled in: triggerStandardExportFlow -> setupQrBoxEvents -> compileOvpnProfileText

	try {
		// Read all 5 crypto files simultaneously in parallel
		const readSafe = async function (path) {
			const content = await rpcReadFile(path);
			if (content) {
				return content;
			} else {
				return '';
			}
		};

		// Read all 5 crypto files simultaneously in parallel
		const rawFilesArray = await Promise.all([
			readSafe(CFG.FILE.dir_cfg + nextId + '.conf'),
			readSafe(CFG.FILE.dir_keys + 'ca_' + nextId + '.crt'),
			readSafe(CFG.FILE.dir_keys + rolePrefix + nextId + '.crt'),
			readSafe(CFG.FILE.dir_keys + rolePrefix + nextId + '.key'),
			readSafe(CFG.FILE.dir_keys + rolePrefix + nextId + '.tls2.key')
		]);

		// Validate that we actually have the configuration and the required keys
		if (!rawFilesArray || rawFilesArray.length < 5 || !rawFilesArray[0]) {
			L.ui.addNotification(null, E('p', {}, TXT.ERROR.config_key_missing), 'error');
			return;
		}

		const serverAssets = Object.assign({}, SERVER_FILES_TEMPLATE, {
			conf: rawFilesArray[0],
			ca: rawFilesArray[1],
			cert: rawFilesArray[2],
			key: rawFilesArray[3],
			tlsCrypt: rawFilesArray[4]
		});;


		// Check if this server configuration is Site-To-Site
		const isSiteToSite = appData.statusClass.parseSiteToSite(serverAssets.conf);

		// Read connection parameters instantly from your clean instObj RAM cache!
		const serverProto = instObj.proto || OPENVPN.PROTO.UDP;
		const internalPort = instObj.port || OPENVPN.PORT.s1194;

		// Read the custom client port range directly from the template schema
		const currentPort = instObj.portExtern || internalPort;

		// Match both the variable type [1] and the target value [2] using capturing groups
		const ddnsMetaMatch = serverAssets.conf.match(/^setenv\s+(DDNS|PUBLIC_DOMAIN|PUBLIC_STATIC_IP|PUBLIC_DYNAMIC_IP)\s+"?(\S+?)"?$/m);

		const configIpType = ddnsMetaMatch ? ddnsMetaMatch[1] : '';
		const savedHost = ddnsMetaMatch ? ddnsMetaMatch[2].trim() : '';
		let finalHost = '';

		// If it is a permanent domain name or verified static IP, never overwrite it
		if (configIpType === 'DDNS' || configIpType === 'PUBLIC_DOMAIN' || configIpType === 'PUBLIC_STATIC_IP') {
			finalHost = savedHost;
		} else {
			// For unverified dynamic IPs, try to get the public IP via our flat cache engine
			try {
				const liveDetectedIp = await getDdnsOrPublicIp(instObj, false);
				finalHost = liveDetectedIp || savedHost || window.location.hostname;
			} catch {
				finalHost = savedHost || window.location.hostname;
			}
		}

		const exportStaticPath = CFG.FILE.dir_cfg + nextId + '.ovpn';

		const ovpnDownloadParams = {
			nextId: nextId,
			displayId: displayId,
			port: currentPort,
			proto: serverProto,
			exportPath: exportStaticPath,
			instance_id: instance_id,
			saveApplyOpenVPN: false
		};

		// --- TYPE A: Flow for standard devices (Mobile Apps) ---
		const triggerStandardExportFlow = function (finalCryptoBundle, overrideCn, saveApplyOpenVPN) {
			const ovpnParamsUpdated = Object.assign({}, ovpnDownloadParams);
			let title;
			if (overrideCn) {
				title = ICON.OFFICE + TXT.MSG.client_export;
				ovpnParamsUpdated.displayId = overrideCn;
			} else {
				title = ICON.MOBILE + TXT.MSG.mobile_export;
			}
			if (saveApplyOpenVPN) {
				ovpnParamsUpdated.saveApplyOpenVPN = saveApplyOpenVPN;
			}
			const ui = createQrBoxElements(finalHost);
			setupQrBoxEvents(ui, ovpnParamsUpdated, finalCryptoBundle, appData, isSiteToSite);
			L.ui.showModal(title + ': ' + ovpnParamsUpdated.displayId, [
				renderClientOvpnProfileModal(ui.nodes.wrapper, ui.nodes.url, ui.nodes.qr, ui.buttons.download, ui.buttons.close)
			]);
		};

		// If it is a standard mobile server, open the Mobile Export modal to generate unique client_pki keys first
		if (!isSiteToSite) {
			openMobileExportModal(instance_id, nextId, serverAssets, finalHost, triggerStandardExportFlow, appData);
			return;
		}

		// Parse existing office names safely from the configuration content string rows
		const activeBranchNames = [];
		const nameRegex = /setenv\s+CLIENT_CNAME_\d+\s+"([^"]+)"/g;
		let regexMatch = nameRegex.exec(serverAssets.conf);

		while (regexMatch !== null) {
			if (regexMatch && regexMatch[1]) {
				const cleanName = regexMatch[1].trim();
				if (cleanName && activeBranchNames.indexOf(cleanName) === -1) {
					activeBranchNames.push(cleanName);
				}
			}
			regexMatch = nameRegex.exec(serverAssets.conf);
		}

		// --- TYPE B: Open the clean isolated Site-to-Site Selection Modal UI Sub-Routine ---
		openSiteToSiteExportModal(instance_id, nextId, serverAssets, activeBranchNames, finalHost, triggerStandardExportFlow, appData);

	} catch (err) {
		// Central error interception handler cleanly logs all file system crashes
		L.ui.addNotification(null, E('p', {}, TXT.ERROR.build_profile + ' ' + err.message), 'error');
	}
};


/**
 * --- STATUS VIEW ---
 */


/**
 * Updates the visual styles, backgrounds, and action buttons based on the operational three-way state.
 */
const updateStatusBoxVisuals = function (ovpnState, badgeLabelNode, badgeImgNode, boxHeadNode, btnEnableOpenVPN) {

	if (ovpnState === OPENVPN.STATE.active) {
		badgeLabelNode.textContent = TXT.INFO.openvpn + ' (' + TXT.INFO.active + ')';
		badgeImgNode.src = CFG.FILE.vpn_enabled_img;
		if (boxHeadNode) {
			boxHeadNode.style.setProperty('background', 'var(--success-color-high, #00ac59)', 'important');
			boxHeadNode.style.setProperty('color', 'var(--on-success-color, white)', 'important');
		}
		if (badgeLabelNode) {
			badgeLabelNode.style.setProperty('color', 'var(--on-success-color, white)', 'important');
		}

		if (btnEnableOpenVPN) {
			btnEnableOpenVPN.className = 'cbi-button cbi-button-negative important';
			btnEnableOpenVPN.textContent = TXT.INFO.disable + ' ' + TXT.INFO.openvpn;
		}
	} else if (ovpnState === OPENVPN.STATE.pending) {
		badgeLabelNode.textContent = TXT.INFO.openvpn + ' (' + TXT.INFO.pending + ')';
		badgeImgNode.src = CFG.FILE.vpn_disabled_img;
		if (boxHeadNode) {
			boxHeadNode.style.setProperty('background', 'var(--warn-color-high, #efbd0b)', 'important');
			boxHeadNode.style.setProperty('color', 'var(--on-warn-color, #000000)', 'important');
		}
		if (badgeLabelNode) {
			badgeLabelNode.style.setProperty('color', 'var(--on-warn-color, #000000)', 'important');
		}

		if (btnEnableOpenVPN) {
			btnEnableOpenVPN.className = 'cbi-button cbi-button-negative important';
			btnEnableOpenVPN.textContent = TXT.INFO.disable + ' ' + TXT.INFO.openvpn;
		}
	} else if (ovpnState === OPENVPN.STATE.error) {
		badgeLabelNode.textContent = TXT.INFO.openvpn + ' (' + TXT.INFO.error + ')';
		badgeImgNode.src = CFG.FILE.vpn_disabled_img;
		if (boxHeadNode) {
			boxHeadNode.style.setProperty('background', 'var(--error-color-high, #f62b12)', 'important');
			boxHeadNode.style.setProperty('color', 'var(--on-error-color, white)', 'important');
		}
		if (badgeLabelNode) {
			badgeLabelNode.style.setProperty('color', 'var(--on-error-color, white)', 'important');
		}

		if (btnEnableOpenVPN) {
			btnEnableOpenVPN.className = 'cbi-button cbi-button-negative important';
			btnEnableOpenVPN.textContent = TXT.INFO.disable + ' ' + TXT.INFO.openvpn;
		}
	} else {
		badgeLabelNode.textContent = TXT.INFO.openvpn + ' (' + TXT.INFO.disabled + ')';
		badgeImgNode.src = CFG.FILE.vpn_disabled_img;
		if (boxHeadNode) {
			boxHeadNode.style.setProperty('background', 'var(--background-color-medium, #f4f4f5)', 'important');
			boxHeadNode.style.setProperty('color', 'var(--text-color-high, #333333)', 'important');
		}
		if (badgeLabelNode) {
			badgeLabelNode.style.setProperty('color', 'var(--text-color-high, #333333)', 'important');
		}

		if (btnEnableOpenVPN) {
			btnEnableOpenVPN.className = 'cbi-button cbi-button-positive important';
			btnEnableOpenVPN.textContent = TXT.INFO.enable + ' ' + TXT.INFO.openvpn;
		}
	}
};

/**
 * Status Control Box Containser
 */
let statusControlBox = null;
let statusTooltipNode = null;

/**
 * Handles the main toggle button click event to cycle all instances.
 */
const handelEnableOpenVPN = function (ovpnUciSections, ifaceBoxMasterNode, addServerBtn, addClientBtn, badgeLabelNode, badgeImgNode, boxHeadNode, applyNotice, btnEnableOpenVPN) {
	const ovpnSections = ovpnUciSections || [];

	if (ovpnSections.length === 0) return;

	ifaceBoxMasterNode.style.opacity = '0.4';
	btnEnableOpenVPN.disabled = true;
	if (addServerBtn) addServerBtn.disabled = true;
	if (addClientBtn) addClientBtn.disabled = true;

	const unlockUI = function () {
		ifaceBoxMasterNode.style.opacity = '1';
		btnEnableOpenVPN.disabled = false;
		if (addServerBtn) addServerBtn.disabled = false;
		if (addClientBtn) addClientBtn.disabled = false;
	};

	const nextState = isAnyInstanceEnabled(ovpnSections) ? '0' : '1';

	for (let k = 0; k < ovpnSections.length; k++) {
		if (ovpnSections[k] && ovpnSections[k]['.name']) {
			L.uci.set(CFG.CMD.openvpn, ovpnSections[k]['.name'], 'enabled', nextState);
		}
	}

	updateStatusBoxVisuals(nextState, badgeLabelNode, badgeImgNode, boxHeadNode, btnEnableOpenVPN);

	if (statusControlBox) {
		statusControlBox.setAttribute('data-current-state', nextState);
	}
	applyNotice.style.display = 'inline-block';

	uciSaveApply(
		function () {
			ovpnServiceStartStop.Request = true;
			ovpnServiceStartStop.Instance = ""
			ovpnServiceStartStop.Action = (nextState === '0') ? CFG.CMD.stop : CFG.CMD.start;
		},
		null,
		unlockUI,
		null
	);
};

/**
 * Open Wizard normally
 */
const openWizardBtnClick = function (appData, newInstNumber, hideClient) {
	if (!newInstNumber) {
		newInstNumber = getNextInstanceNumber(appData);
	}
	const wizardData = Object.assign({}, appData.wizardClass.WIZARD_DATA_TEMPLATE, {
		appData: appData,
		addNewInstanceCallback: addNewInstance,
		networkCallbacks: networkCallbacks,
		uciSaveApplyRestartCallback: uciSaveApplyRestart,
		importOvpnClientProfileCallback: importOvpnClientProfile,
		instanceNumber: newInstNumber,
		forcedScenario: null,
	});
	appData.wizardClass.openWizardModal(wizardData, hideClient);
}

/**
 * Renders the status control and setup wizard box for OpenVPN
 */
const renderStatusControlBox = function (ovpnInitialState, addServerBtn, addClientBtn, appData) {
	const applyNotice = E('span', { 'class': 'text-danger', 'style': 'font-weight:bold; margin-left:15px; display:none;' }, ICON.WARNING + TXT.BTN.click_save_apply);
	const newInstNumber = getNextInstanceNumber(appData);

	const btnEnableOpenVPN = E('button', {
		'style': 'text-shadow:none !important; box-shadow:none !important; white-space:nowrap;'
	}, '');

	// Show Wizard button
	const openWizardBtn = E('button', {
		'class': 'cbi-button cbi-button-apply important',
		'style': 'text-shadow: none !important; ' +
			'box-shadow: 0 4px 6px -1px color-mix(in srgb, var(--primary-color-high, #1976d2) 20%, transparent) !important; ' +
			'white-space: nowrap; ' +
			'padding: 6px 16px; ' +
			'font-weight: bold; ' +
			// FLEXBOX: keep icon in the middle
			'display: inline-flex; ' +
			'align-items: center; ' +
			'justify-content: center; ' +
			'gap: 8px;'
	}, [
		E('span', { 'style': 'font-size: 16px; line-height: 1;' }, ICON.ROCKET),
		E('span', {}, TXT.INFO.wizard + ' ...')
	]);

	// Right control container with a crisp vertical layout to stack buttons
	const rightControlContainer = E('div', {
		'style': 'display:flex; flex-direction:column; gap:25px; align-items:stretch; margin-left:auto;'
	}, [
		openWizardBtn,
		btnEnableOpenVPN
	]);

	// Set dynamic badge label based on the calculated three-way status
	let labelText = TXT.INFO.openvpn + ' (' + TXT.INFO.disabled + ')';
	if (ovpnInitialState === OPENVPN.STATE.active) {
		labelText = TXT.INFO.openvpn + ' (' + TXT.INFO.active + ')';
	} else if (ovpnInitialState === OPENVPN.STATE.error) {
		labelText = TXT.INFO.openvpn + ' (' + TXT.INFO.error + ')';
	} else if (ovpnInitialState === OPENVPN.STATE.pending) {
		labelText = TXT.INFO.openvpn + ' (' + TXT.INFO.starting + ')';
	}

	const badgeLabelNode = E('strong', { style: 'color:white !important;' }, labelText);
	const badgeImgNode = E('img', { 'class': 'middle', 'style': 'width:48px; height:48px; vertical-align:middle;' });

	const boxHeadNode = E('div', {
		'class': 'ifacebox-head',
		'style': 'padding:3px 8px; font-size:12px; text-shadow:none !important;'
	}, [badgeLabelNode]);

	statusTooltipNode = appData.statusClass.getTooltipNode(ovpnInitialState, appData);

	const tooltipContainer = E('span', { 'class': 'cbi-tooltip-container' }, [
		badgeImgNode,
		statusTooltipNode
	]);

	const boxBodyNode = E('div', {
		'class': 'ifacebox-body',
		'style': 'padding:12px; text-align:center; min-height:0; background:transparent !important;'
	}, [
		tooltipContainer
	]);

	// Apply corporate styles, action labels, and colors directly
	updateStatusBoxVisuals(ovpnInitialState, badgeLabelNode, badgeImgNode, boxHeadNode, btnEnableOpenVPN);

	const ifaceBoxMasterNode = E('div', {
		'class': 'ifacebox',
		'style': 'display:inline-block; width:160px; vertical-align:middle; margin:0; transition:opacity 0.15s ease-in-out; border:1px solid var(--border-color-medium, #cbd5e1); border-radius:4px; overflow:hidden;'
	}, [boxHeadNode, boxBodyNode]);


	btnEnableOpenVPN.addEventListener('click', function (ev) {
		ev.preventDefault();
		handelEnableOpenVPN(appData.ovpnUciSections, ifaceBoxMasterNode, addServerBtn, addClientBtn, badgeLabelNode, badgeImgNode, boxHeadNode, applyNotice, btnEnableOpenVPN);
	});

	// Bind click handler to bridge execution flow into the separate wizard module class
	openWizardBtn.addEventListener('click', function (ev) {
		ev.preventDefault();
		openWizardBtnClick(appData, newInstNumber, false)
	});


	return E('div', { 'style': 'margin-bottom:25px; width:100%;' }, [
		E('h2', { 'style': 'font-weight:bold; margin:0 0 10px 0; padding:0;' }, TXT.INFO.title_main),
		E('p', { 'style': 'font-style:normal; margin-bottom:20px; color:color-mix(in srgb, var(--text-color-medium, #71717a) 85%, #0055ff);' }, TXT.MSG.manage_instance),
		E('fieldset', { 'class': 'class_fieldset', 'style': 'margin-bottom:5px; padding:0; border:0; background:transparent;' }, [
			E('div', { 'style': 'display:flex; align-items:flex-start; justify-content:space-between; padding:3px 0; margin:0; min-height:0; width:100%;' }, [
				E('div', { 'style': 'display:inline-flex; align-items:center;' }, [
					ifaceBoxMasterNode, applyNotice
				]),
				rightControlContainer
			])
		])
	]);
};

/**
 * Refreshes the status control box and tooltip
 */
const refreshStatusBoxCallback = function (ovpnNewState, tooltip, appData) {

	statusTooltipNode = tooltip;

	if (statusControlBox && statusControlBox.firstChild) {
		const currentVpnState = statusControlBox.getAttribute('data-current-state');

		if (currentVpnState !== ovpnNewState) {
			const mainControlBoxNode = renderStatusControlBox(ovpnNewState, null, null, appData);
			statusControlBox.replaceChild(mainControlBoxNode, statusControlBox.firstChild);
			statusControlBox.setAttribute('data-current-state', ovpnNewState);
		}
	}
};


/**
 * --- OPENVPN INSTANCES  ---
 */


/**
 * Finds the lowest available instance number starting from 1
 */
const getNextInstanceNumber = function (appData) {
	// 1. Extract all existing numbers into an array
	const existingNumbers = [];

	if (appData.ovpnUciSections && appData.ovpnUciSections.length > 0) {
		appData.ovpnUciSections.forEach(function (section) {
			const numMatch = section['.name'].match(/\d+$/);
			if (numMatch) {
				existingNumbers.push(parseInt(numMatch[0], 10));
			}
		});
	}

	// 2. Loop from 1 upwards and return the first number that is not in the array
	let checkNum = 1;
	while (existingNumbers.indexOf(checkNum) !== -1) {
		checkNum++;
	}

	return checkNum;
};

/**
 * Renders the control row with Show, Download, and Upload buttons for the key files
 */
const renderKeyButtons = function (label, filename, instance_id, displayId, default_key, role, appData, last_button) {
	const randId = 'file_' + filename.replace(/\./g, '_');
	const fileInput = E('input', { 'type': 'file', 'id': randId, 'style': 'display:none;' });

	const showBtn = E('button', {
		'class': 'cbi-button cbi-button-apply important',
		'style': 'margin: 0 0 0 4px; text-shadow:none !important; box-shadow:none !important;'
	}, TXT.BTN.show);

	const downloadBtn = E('button', {
		'class': 'cbi-button cbi-button-save',
		'style': 'margin: 0 0 0 4px;'
	}, TXT.BTN.download);

	const uploadBtn = E('label', {
		'for': randId,
		'class': 'cbi-button cbi-button-neutral',
		'style': 'margin: 0 0 0 4px;'
	}, TXT.BTN.upload);

	const statusMsg = E('span', { 'style': 'font-weight:bold; margin-left:10px; font-size:11px;' }, '');

	// upload key file
	fileInput.addEventListener('change', function (ev) {
		const files = ev.target.files;
		if (!files || files.length === 0) return;

		uploadBtn.classList.add('disabled');
		statusMsg.textContent = TXT.BTN.saving;
		statusMsg.className = 'text-warning';
		const realPath = CFG.FILE.dir_keys + filename;
		const tmpFilename = filename + '.tmp';
		const tmpPath = CFG.FILE.dir_keys + tmpFilename;

		const reader = new FileReader();
		reader.onload = async function (e) {
			try {
				// Standardize line endings instantly (Supports UNIX \n, Windows \r\n, and Mac \r)
				const sanitizedResult = sanitizeInputText(e.target.result);

				// Step 1: Upload to temporary file
				await rpcWriteFile(tmpPath, sanitizedResult);

				// Step 2: Validate cryptographic metadata
				const rawMeta = await luci_app_openvpn_plus([CFG.LIBEXEC.keymeta, tmpFilename]);

				// Check for syntax errors or corrupted format
				if (rawMeta.length === 0 || rawMeta.indexOf('ERROR') !== -1) {
					await rpcRemoveFile(tmpPath);
					statusMsg.className = 'text-danger';
					statusMsg.textContent = ICON.ERROR + ' ' + TXT.MSG.uploaded_file_invalid;
					uploadBtn.classList.remove('disabled');
					throw new Error(TXT.KEY.key_verification_failed);
				}

				let typeMismatch = false;

				if (default_key === CFG.FILE.ca_def_crt || default_key === CFG.FILE.server_def_crt || default_key === CFG.FILE.client_def_crt) {
					if (rawMeta.indexOf('Public-Key') === -1) typeMismatch = true;
				} else if (default_key === CFG.FILE.server_def_key || default_key === CFG.FILE.client_def_key) {
					if (rawMeta.indexOf('Private-Key') === -1) typeMismatch = true;
				} else if (default_key === CFG.FILE.dh_def_pem) {
					if (rawMeta.indexOf('DH Parameters') === -1) typeMismatch = true;
				} else if (default_key === CFG.FILE.server_def_tls2) {
					// ToDo check  LIBEXEC.keymeta
					if (rawMeta.indexOf('TLSv-Server-Key') === -1) typeMismatch = true;
				} else if (default_key === CFG.FILE.client_def_tls2) {
					// ToDo check LIBEXEC.keymeta
					if (rawMeta.indexOf('TLSv2-Client-Key') === -1) typeMismatch = true;
				}

				// Step 3: Show warning modal if key type mismatch occurs
				if (typeMismatch) {
					await new Promise(function (resolve, reject) {
						L.showModal(ICON.WARNING + TXT.WARNING.key_upload_title, E('div', { 'class': 'cbi-modal' }, [
							E('p', { 'style': 'margin-bottom: 12px; font-size: 13px; line-height: 1.4;' },
								TXT.WARNING.key_upload_nomatch
							),
							E('p', { 'style': 'margin-bottom: 16px; font-size: 13px; color:color-mix(in srgb, var(--text-color-medium, #71717a) 85%, #0055ff); line-height: 1.4;' },
								TXT.WARNING.key_upload_processing
							),
							E('p', {
								'style': 'font-weight: bold; color: var(--error-color-high, #f62b12); margin-bottom: 20px; font-size: 13px;'
							},
								TXT.WARNING.key_upload_save_anyway
							),

							E('div', { 'class': 'right' }, [
								E('button', {
									'class': 'btn cbi-button-action important',
									'style': 'margin-right: 10px;',
									'click': async function () {
										L.hideModal();
										await rpcRemoveFile(tmpPath);
										statusMsg.className = 'text-danger';
										statusMsg.textContent = ICON.ERROR + ' ' + TXT.ERROR.wrong_key_type;
										uploadBtn.classList.remove('disabled');
										reject(new Error(TXT.ERROR.key_type_mismatch));
									}
								}, TXT.INFO.no),
								E('button', {
									'class': 'btn cbi-button-neutral',
									'click': function () {
										L.hideModal();
										resolve();
									}
								}, TXT.INFO.yes)
							])
						]));
					});
				}

				// Step 4: Move validated temporary file to real path
				await rpcWriteFile(realPath, sanitizedResult);
				await rpcRemoveFile(tmpPath);

				statusMsg.className = 'text-success';
				statusMsg.textContent = ICON.SUCCESS + TXT.BTN.saved + ' ' + ICON.WARNING + TXT.BTN.click_save_apply;

				uciSaveApplyRestart(instance_id);

			} catch (err) {
				if (err.message !== TXT.KEY.key_verification_failed && err.message !== TXT.ERROR.key_type_mismatch) {
					statusMsg.className = 'text-danger';
					statusMsg.textContent = ICON.ERROR + ' ' + TXT.INFO.error + ': ' + err.message;
				}
			} finally {
				uploadBtn.classList.remove('disabled');
			}
		};

		reader.readAsText(files[0]);
	});

	// show key file
	showBtn.addEventListener('click', function (ev) {
		ev.preventDefault();
		appData.keygenClass.openKeyEditorModal(filename, instance_id, displayId, role, appData, uciSaveApplyRestart, rpcFileCallbacks);
	});

	// download key file
	downloadBtn.addEventListener('click', async function (ev) {
		ev.preventDefault();

		// 1. Fetch the file content natively via ubus RPC
		const content = await rpcReadFile(CFG.FILE.dir_keys + filename);

		// 2. If the file is missing or empty (returns null or empty string)
		if (!content) {
			if (L.ui && typeof L.ui.addNotification === 'function') {
				L.ui.addNotification(null, E('p', TXT.KEY.keyfile_not_exist), 'warning');
			}
			return;
		}

		// 3. Create a secure browser download blob from the string data
		const blob = new Blob([content], { type: 'text/plain' });
		const link = document.createElement('a');

		link.href = URL.createObjectURL(blob);
		link.download = filename;

		// 4. Trigger the hidden download mechanism in the browser DOM
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	});

	let borderStyle;
	if (last_button) {
		borderStyle = "border:0;"
	} else {
		borderStyle = "border-bottom:1px dashed var(--border-color-medium, #cbd5e1);"
	}

	return E('div', {
		'style': 'display:flex; align-items:center; justify-content:space-between; padding:3px 0; margin:0; ' + borderStyle + ' min-height:0; width:100%;'
	}, [
		E('span', { 'style': 'font-size:13px; font-weight:normal; text-align:left; margin:0; padding:0;' }, label),
		E('div', { 'style': 'display:inline-flex; align-items:center; margin:0; padding:0;' }, [
			showBtn, downloadBtn, uploadBtn, fileInput, statusMsg
		])
	]);
};

/**
 * Update port and proto in the smart firewall rules file 'instance*.nft'
 */
const updateSmartFirewallFile = async function (instance_id, port, proto) {
	const nftFilePath = CFG.FILE.dir_cfg + instance_id + '.nft';
	const nftFileRaw = await rpcReadFile(nftFilePath);
	let nftFile = String(nftFileRaw || '').trim();
	if (nftFile.length > 0) {
		nftFile = nftFile.replace(new RegExp(CFG.ID.instance + '0', 'g'), instance_id);
		nftFile = nftFile.replace(new RegExp(CFG.ID.fwPort + '\\s*=\\s*\\d+', 'g'), CFG.ID.fwPort + '=' + port);
		nftFile = nftFile.replace(new RegExp(CFG.ID.fwProto + '\\s*=\\s*"[^"]*"', 'g'), CFG.ID.fwProto + '="' + proto + '"');
	}
	await rpcWriteFile(nftFilePath, nftFile);
}

/**
 * Saves the modified configuration text and handles the instance restart logic
 */
const handleInstanceSave = async function (instance_id, instObj, role, txtArea, saveBtn, sNotice, originalConfContent, modificationBoxNode, appData, clientUpdateOnly) {
	// Clean and standardize all line endings instantly (Supports UNIX \n, Windows \r\n, and Mac \r)
	const newConfigContent = sanitizeInputText(txtArea.value) + '\n';
	const cleanOriginal = String(originalConfContent || '').trim() + '\n';
	const originalButtonText = saveBtn.textContent;

	// Abort if no changes occurred inside the text area field
	if (newConfigContent === cleanOriginal) {
		saveBtn.disabled = true;
		saveBtn.textContent = ICON.INFO + TXT.INFO.no_changes_detected;

		setTimeout(function () {
			saveBtn.disabled = false;
			saveBtn.textContent = originalButtonText;
		}, 1500);
		return;
	}

	saveBtn.disabled = true;
	saveBtn.textContent = ICON.LOADING + TXT.INFO.creating;

	let serverSiteToSite = false;
	let smartFirewallEnabled = false;

	let currentPort = appData.statusClass.parsePortFromConfig(role, originalConfContent);
	if (!currentPort || isNaN(currentPort)) {
		currentPort = appData.statusClass.calcPortFromId(instance_id);
	}
	const newPort = appData.statusClass.parsePortFromConfig(role, newConfigContent);
	let newProto = appData.statusClass.parseProtoFromConfig(newConfigContent);

	const detectedProto = appData.statusClass.parseProtoFromConfig(newConfigContent);

	if (role === OPENVPN.ROLE.SERVER) {

		// check if 'setenv sitetosite on'
		serverSiteToSite = appData.statusClass.parseSiteToSite(newConfigContent);

		// check if 'setenv ovpnfirewall on'
		smartFirewallEnabled = appData.statusClass.parseSiteToSite(newConfigContent);
	}

	const isCurrentlyEnabled = isInstanceEnabled(instance_id);
	if (isCurrentlyEnabled) {
		if (sNotice) {
			sNotice.style.display = 'inline-block';
		}
	}

	try {


		// Write the finalized configuration file directly to the disk memory
		await rpcWriteFile(CFG.FILE.dir_cfg + instance_id + '.conf', newConfigContent);

		// Update the local instance port property inside the RAM cache instantly
		if (Array.isArray(appData.instances)) {
			for (const instance of appData.instances) {
				if (instance && instance.id === instance_id) {
					instance.confContent = newConfigContent;
					instance.port = newPort || currentPort;
					break;
				}
			}
		}

		if (role === OPENVPN.ROLE.SERVER) {
			await updateSmartFirewallFile(instance_id, newPort, newProto);
		}
		await syncInstanceFirewallRule(instance_id, instObj, role, newPort, detectedProto, serverSiteToSite, smartFirewallEnabled, appData, newConfigContent);

		// Trigger changes system banner and restart workflow if needed
		if (isCurrentlyEnabled) {
			uciSaveApplyRestart(instance_id);
		} else {
			reloadFirewall.checkRequest();
			if (modificationBoxNode && typeof modificationBoxNode.setAttribute === 'function') {
				modificationBoxNode.setAttribute('data-original-content', newConfigContent);
			}
		}

		// Compilation finished successfully
		saveBtn.textContent = ICON.SUCCESS + TXT.BTN.saved;

	} catch (err) {
		// Universal catch block intercepts all disk or firewall RPC failures
		console.error('Failed to write OpenVPN configuration for ' + instance_id + ':', err);
		saveBtn.textContent = ICON.ERROR + TXT.INFO.error;

	} finally {
		setTimeout(function () {
			saveBtn.disabled = false;
			saveBtn.textContent = originalButtonText;
			if (sNotice) {
				sNotice.style.display = 'none';
			}
		}, 1500);
	}
};

/**
 * Deletes an OpenVPN instance and its firewall rules
 */
const handleInstanceDeletion = function (instance_id, displayId, delBtn, dNotice, sectionRootNode) {
	if (window.confirm(TXT.MSG.confirm_del + displayId + '?')) {
		// Lock the delete button and show the loading notice immediately
		delBtn.disabled = true;
		dNotice.style.display = 'inline-block';

		L.uci.remove(CFG.CMD.openvpn, instance_id);
		removeInstanceFirewallRule(instance_id);

		uciSaveApply(
			null,
			function () {
				// saved
				if (sectionRootNode) {
					sectionRootNode.style.opacity = '0.4';
					sectionRootNode.style.pointerEvents = 'none';
				}
				delBtn.textContent = ICON.SUCCESS + TXT.BTN.del_ready;
			},
			function () {
				// finally
				dNotice.style.display = 'none';
				delBtn.disabled = false;
			},
			function (err) {
				console.error('Failed to delete OpenVPN instance ' + instance_id + ':', err);
			}
		);
	}
};


/**
 * Shows the collapsible box containing all cryptographic key files, keeping control buttons always visible.
 */
const renderKeysBox = function (instance_id, displayId, role, ovpnProfileBtn, keygenBtn, appData) {
	const isServer = (role === OPENVPN.ROLE.SERVER);
	const certLabel = isServer ? TXT.KEY.server_crt : TXT.KEY.client_crt;
	const keyLabel = isServer ? TXT.KEY.server_key : TXT.KEY.client_key;
	const def_crt = isServer ? CFG.FILE.server_def_crt : CFG.FILE.client_def_crt;
	const def_key = isServer ? CFG.FILE.server_def_key : CFG.FILE.client_def_key;
	const tlsLabel = isServer ? TXT.KEY.server_tls : TXT.KEY.client_tls;
	const def_tls = isServer ? CFG.FILE.server_def_tls2 : CFG.FILE.client_def_tls2;
	const rolePrefix = role + '_';

	// Create the detailed content wrapper for the key lines (Hidden by default)
	const keysContentContainer = E('div', {
		'style': 'margin-bottom:10px; display:none;'
	}, [
		renderKeyButtons(ICON.POINT + TXT.KEY.ca + ' (ca_' + instance_id + '.crt)', 'ca_' + instance_id + '.crt', instance_id, displayId, CFG.FILE.ca_def_crt, role, appData, false),
		renderKeyButtons(ICON.POINT + certLabel + ' (' + rolePrefix + instance_id + '.crt)', rolePrefix + instance_id + '.crt', instance_id, displayId, def_crt, role, appData, false),
		renderKeyButtons(ICON.POINT + keyLabel + ' (' + rolePrefix + instance_id + '.key)', rolePrefix + instance_id + '.key', instance_id, displayId, def_key, role, appData, false),
		(role === OPENVPN.ROLE.SERVER) ? renderKeyButtons(ICON.POINT + TXT.KEY.dh + ' (dh_' + instance_id + '.pem)', 'dh_' + instance_id + '.pem', instance_id, displayId, CFG.FILE.dh_def_pem, role, appData, false) : '',
		renderKeyButtons(ICON.POINT + tlsLabel + ' (' + rolePrefix + instance_id + '.tls2.key)', rolePrefix + instance_id + '.tls2.key', instance_id, displayId, def_tls, role, appData, true),
	]);

	// Generate the compact inline summary string for the collapsed state
	let summaryTextString = ICON.POINT + TXT.KEY.ca + ' (ca_' + instance_id + '.crt) | ' +
		ICON.POINT + certLabel + ' (' + rolePrefix + instance_id + '.crt) | ' +
		ICON.POINT + keyLabel + ' (' + rolePrefix + instance_id + '.key) | ';

	if (role === OPENVPN.ROLE.SERVER) {
		summaryTextString += ICON.POINT + TXT.KEY.dh + ' (dh_' + instance_id + '.pem) | ';
	}
	summaryTextString += ICON.POINT + tlsLabel + ' (' + rolePrefix + instance_id + '.tls2.key)';

	// Create the element node for the inline text (Visible by default)
	const inlineSummaryLine = E('div', {
		'style': 'width:100%; display:block; font-size:11px; font-family:var(--font-monospace, monospace); color:color-mix(in srgb, var(--text-color-medium, #71717a) 85%, #0055ff); padding:4px 5px; margin-bottom:8px; white-space:normal; word-break:break-all;'
	}, summaryTextString);

	// Create the arrow to show the toggle state
	const toggleArrow = E('span', {
		'style': 'margin-right:8px; font-size:11px; cursor:pointer; user-select:none;'
	}, '▶ ');

	// Assemble the interactive clickable title bar header
	const clickableTitle = E('legend', {
		'style': 'font-weight:bold; font-size:13px; padding:0 8px; cursor:pointer; user-select:none;',
		'click': function () {
			const isHidden = (keysContentContainer.style.display === 'none');

			if (isHidden) {
				keysContentContainer.style.display = 'block';
				keygenBtn.style.display = 'block';
				inlineSummaryLine.style.display = 'none'; // Hide text row when box expands
				toggleArrow.textContent = '▼ ';
			} else {
				keysContentContainer.style.display = 'none';
				keygenBtn.style.display = 'none';
				inlineSummaryLine.style.display = 'block'; // Show text row when box collapses
				toggleArrow.textContent = '▶ ';
			}
		}
	}, [
		toggleArrow,
		TXT.KEY.openvpn_keys
	]);

	// Return the finalized component
	return E('fieldset', {
		'class': 'cbi-section-fieldset',
		'style': 'margin-bottom:20px; padding:15px; border:1px solid var(--border-color-medium, #cbd5e1); border-radius:4px; background:transparent;'
	}, [
		clickableTitle,
		E('div', { 'class': 'cbi-section-node', 'style': 'padding:0 5px;' }, [
			// Structural layout sorting slots
			keysContentContainer,
			inlineSummaryLine,

			// The action buttons container remains outside the collapsible block (always visible)
			E('div', { 'style': 'width:100%; display:block; overflow:hidden; border-top:1px dashed var(--border-color-medium, #cbd5e1); padding-top:5px; margin-top:0px;' }, [
				ovpnProfileBtn,
				((role === OPENVPN.ROLE.SERVER) ? keygenBtn : '')
			])
		])
	]);
};

/**
 * Shows the collapsible fieldset text box for editing the configuration file
 */
const renderConfigEditor = function (instance_id, txtArea, saveBtn) {

	// Create the content wrapper that will be hidden or shown
	const contentContainer = E('div', {
		'style': 'padding:0 2px; display:none;'
	}, [txtArea]);
	const configPathLine = E('div', {
		'style': 'width:100%; display:block; font-size:11px; font-family:var(--font-monospace, monospace); color:color-mix(in srgb, var(--text-color-medium, #71717a) 85%, #0055ff); padding:4px 2px; margin-bottom:10px; white-space:normal; word-break:break-all; font-style:italic;'
	}, ICON.POINT + CFG.FILE.dir_cfg + instance_id + '.conf');

	// Createthe arrow to show the state
	const toggleArrow = E('span', {
		'style': 'margin-right:8px; font-size:11px; cursor:pointer; user-select:none; transition:transform 0.2s;'
	}, '▶ ');

	// Assemble the interactive clickable title bar header
	const clickableTitle = E('legend', {
		'style': 'font-weight:bold; font-size:13px; padding:0 8px; cursor:pointer; user-select:none;',
		'click': function () {
			const isHidden = (contentContainer.style.display === 'none');

			if (isHidden) {
				contentContainer.style.display = 'block';
				toggleArrow.textContent = '▼ ';
				saveBtn.style.display = 'block'
			} else {
				contentContainer.style.display = 'none';
				toggleArrow.textContent = '▶ ';
				saveBtn.style.display = 'none'
			}
		}
	}, [
		toggleArrow,
		TXT.MSG.edit_config
	]);

	// Return the finalized component
	return E('fieldset', {
		'class': 'cbi-section-fieldset',
		'style': 'margin-bottom:20px; padding:15px; border:1px solid var(--border-color-medium, #cbd5e1); border-radius:4px; background:transparent;'
	}, [
		clickableTitle,
		E('div', { 'class': 'cbi-section-node', 'style': 'padding:0 5px;' }, [
			configPathLine,
			contentContainer
		])
	]);
};

/**
 * Shows the collapsible fieldset for port and static routing info
 */
const renderPortAlertBox = function (instObj, role, appData) {

	// Init the alert component
	const portForwardingAlert = appData.wizardClass.renderPortForwardingAlert(networkCallbacks);

	// Create the content wrapper that will be hidden or shown
	const contentContainer = E('div', {
		'style': 'padding:0 2px; display:none;'
	}, [portForwardingAlert.node]);

	const alertPathLine = E('div', {
		'style': 'width:100%; display:block; font-size:11px; font-family:var(--font-monospace, monospace); color:color-mix(in srgb, var(--text-color-medium, #71717a) 85%, #0055ff); padding:4px 2px; margin-bottom:10px; white-space:normal; word-break:break-all; font-style:normal;'
	}, '. . .');

	// Create the arrow to show the state
	const toggleArrow = E('span', {
		'style': 'margin-right:8px; font-size:11px; cursor:pointer; user-select:none; transition:transform 0.2s;'
	}, '▶ ');
	const toggleText = E('span', {}, 'Port Info');

	const showAlertContainer = function (show) {
		if (show === true) {
			contentContainer.style.display = 'block';
			alertPathLine.style.display = 'none';
			toggleArrow.textContent = '▼ ';
		} else {
			contentContainer.style.display = 'none';
			alertPathLine.style.display = 'block';
			toggleArrow.textContent = '▶ ';
		}
	}

	// Assemble the interactive clickable title bar header
	const clickableTitle = E('legend', {
		'style': 'font-weight:bold; font-size:13px; padding:0 8px; cursor:pointer; user-select:none;',
		'click': function () {
			const isHidden = (contentContainer.style.display === 'none');
			showAlertContainer(isHidden);
		}
	}, [
		toggleArrow,
		toggleText
	]);

	const alertBox_displayStyle = networkStructure.doubleNat ? 'display:block;' : 'display: none;';

	const alertBox = E('fieldset', {
		'class': 'cbi-section-fieldset',
		'style': 'margin-bottom:20px; padding:15px; border:1px solid var(--border-color-medium, #cbd5e1); border-radius:4px; background:transparent;' + alertBox_displayStyle
	}, [
		clickableTitle,
		E('div', { 'class': 'cbi-section-node', 'style': 'padding:0 5px;' }, [
			alertPathLine,
			contentContainer
		])
	]);

	const showAlertBoxCallback = function (show, alertData) {

		let enabled = alertData.isPortValid || alertData.sRouteValid || alertData.portStatusText !== '' || alertData.sRouteStatusText !== ''

		if (enabled === true) {
			// get Title
			let portTitle = '';
			let srouteTitle = '';
			let title = '';
			if (role === OPENVPN.ROLE.SERVER) {
				portTitle = 'Port Info';
			}
			if ((instObj.serverSiteToSite == true) || (role === OPENVPN.ROLE.CLIENT)) {
				srouteTitle = 'Static Routing';
			}
			if ((portTitle.length > 0) && (srouteTitle.length > 0)) {
				title = portTitle + " / " + srouteTitle;
			} else {
				title = portTitle + srouteTitle;
			}
			toggleText.textContent = title;


			let nodes = [];
			if (alertData.portStatusText.length > 0) {
				nodes.push(E('span', { 'style': 'filter: grayscale(100%); opacity: 0.8; display: inline-block;' }, alertData.portStatusIcon));
				nodes.push(' ' + alertData.portStatusText);
			}
			if (alertData.sRouteStatusText.length > 0) {
				if (nodes.length > 0) {
					nodes.push(' | ');
				}
				nodes.push(E('span', { 'style': 'filter: grayscale(100%); opacity: 0.8; display: inline-block;' }, alertData.sRouteStatusIcon));
				nodes.push(' ' + alertData.sRouteStatusText);
			}
			L.dom.content(alertPathLine, nodes);

			showAlertContainer(show);

			alertBox.style.display = 'block';
		} else {
			alertBox.style.display = 'none';
		}
	}

	// Setup the alert component
	const setupPortForwardingAlert = async function () {
		// Trigger the port warning on first refresh
		let runBackgroundPortCheckExtern = {};
		runBackgroundPortCheckExtern.callback = showAlertBoxCallback;
		initialRefreshQueue.push(runBackgroundPortCheckExtern);
		await portForwardingAlert.check(
			instObj.proto || OPENVPN.PROTO.UDP,
			role,
			instObj.port || OPENVPN.PORT.s1194,
			instObj.portExtern || OPENVPN.PORT.s1194,
			instObj.remoteSubnets,
			appData,
			false,
			runBackgroundPortCheckExtern
		);
	}
	setupPortForwardingAlert();

	return alertBox;
};

/**
 * Renders the configuration box for a single OpenVPN instance
 */
const renderInstanceBox = function (s, idx, appData) {
	const instance_id = s['.name'];
	let instObj = {};
	if (Array.isArray(appData.instances)) {
		for (let i = 0; i < appData.instances.length; i++) {
			if (appData.instances[i].id === instance_id) {
				instObj = appData.instances[i];
				break;
			}
		}
	}
	const role = instObj.role || OPENVPN.ROLE.SERVER;
	const confContent = instObj.confContent || '';
	const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);
	const instNum = appData.statusClass.getInstanceNumber(instance_id, idx + 1);
	const customDisplayName = L.uci.get(CFG.CMD.openvpn, instance_id, 'displayname') || '';
	const displayId = customDisplayName || (TXT.INFO.instance_x + instNum);
	instObj.displayName = displayId;

	const sectionHeadingText = customDisplayName
		? customDisplayName + ' (' + roleLabel + ')'
		: displayId + ' - ' + roleLabel;

	// Create the name text input field
	const nameInput = E('input', {
		'type': 'text',
		'class': 'cbi-input-text',
		'placeholder': TXT.INFO.instance_x + instNum,
		'value': customDisplayName,
		'style': 'width: 140px; margin-right: 15px; padding: 2px 6px; font-size: 12px; border-radius: 3px; border: 1px solid var(--border-color-medium, #cbd5e1);'
	});

	// Updates the instance display name when the user changes the input field value
	nameInput.addEventListener('change', function (ev) {
		const cleanName = sanitizeInputLine(ev.target.value);
		L.uci.set(CFG.CMD.openvpn, instance_id, 'displayname', cleanName ? cleanName : null);
		instObj.displayName = cleanName || (TXT.INFO.instance_x + instNum);
		uciSaveApply();
	});

	// Create the activation checkbox flag
	const isEnabled = isInstanceEnabled(instance_id);
	const instanceCheckbox = E('input', {
		'type': 'checkbox',
		'id': 'cb_enabled_' + instance_id,
		'style': 'margin-right: 6px; cursor: pointer; width: 16px; height: 16px; vertical-align: middle;',
		'checked': isEnabled ? 'checked' : null
	});

	// Safely updates the instance enable state and registers service background controls on checkbox change
	instanceCheckbox.addEventListener('change', function (ev) {
		L.uci.set(CFG.CMD.openvpn, instance_id, 'enabled', ev.target.checked ? '1' : '0');
		uciSaveApply(function () {
			// init
			ovpnServiceStartStop.Request = true;
			ovpnServiceStartStop.Instance = instance_id;
			ovpnServiceStartStop.Action = ev.target.checked ? CFG.CMD.start : CFG.CMD.stop;
		});
	});

	const checkboxContainer = E('label', {
		'for': 'cb_enabled_' + instance_id,
		'style': 'display: inline-flex; align-items: center; cursor: pointer; font-size: 13px; font-weight: bold;'
	}, [instanceCheckbox, E('span', {}, TXT.BTN.enabled)]);

	// Create the key generator button
	const keygenBtn = E('button', {
		'class': 'cbi-button cbi-button-apply important',
		'style': 'float: right; margin: 10px 10px 0 0; display: none'
	}, TXT.KEY.keygen);

	keygenBtn.addEventListener('click', function (ev) {
		ev.preventDefault();
		appData.keygenClass.openKeyGenModal(instance_id, instObj.displayName, role, appData, uciSaveApplyRestart, rpcFileCallbacks);
	});

	// Create the main configuration text box field
	const txtArea = E('textarea', {
		'class': 'cbi-input-textarea',
		'style': 'width:100%; font-family:var(--font-monospace, monospace); font-size:12px; padding:12px; border-radius:4px; background:var(--background-color-low); border:1px solid var(--border-color-medium, #cbd5e1); text-shadow:none !important;',
		'rows': '15',
		'wrap': 'off'
	}, confContent);

	const saveBtn = E('button', { 'class': 'btn cbi-button cbi-button-save; display:none;' }, TXT.BTN.save_config + ': ' + displayId);
	const cNotice = E('span', { 'class': 'text-danger', 'style': 'font-weight:bold; margin-left:15px; display:none;' }, ICON.WARNING + ' ' + TXT.BTN.click_save_apply);
	const dNotice = E('span', { 'class': 'text-danger', 'style': 'font-weight:bold; font-size:12px; display:none;' }, ICON.WARNING + ' ' + TXT.BTN.click_save_apply);
	const delBtn = E('button', { 'class': 'btn cbi-button cbi-button-remove', 'style': 'float:right;' }, TXT.BTN.del_instance);

	let ovpnProfileBtn = '';
	if (role === OPENVPN.ROLE.SERVER) {
		ovpnProfileBtn = E('button', {
			'class': 'btn cbi-button cbi-button-positive important',
			'style': 'float: right; margin: 10px 10px 0 0;'
		}, TXT.MSG.export_ovpn);
		ovpnProfileBtn.addEventListener('click', function (ev) {
			ev.preventDefault();
			downloadClientOvpnProfile(instance_id, instObj, customDisplayName, appData);
		});
	} else {
		ovpnProfileBtn = E('button', {
			'class': 'btn cbi-button cbi-button-positive important',
			'style': 'float: right; margin: 10px 10px 0 0;'
		}, TXT.MSG.import_ovpn);
		ovpnProfileBtn.addEventListener('click', function (ev) {
			ev.preventDefault();
			const wizardData = Object.assign({}, appData.wizardClass.WIZARD_DATA_TEMPLATE, {
				appData: appData,
				addNewInstanceCallback: addNewInstance,
				networkCallbacks: networkCallbacks,
				uciSaveApplyRestartCallback: uciSaveApplyRestart,
				importOvpnClientProfileCallback: importOvpnClientProfile,
				instanceNumber: instNum,
				forcedScenario: OPENVPN.SCENARIO.SITE_TO_SITE_CLIENT
			});
			appData.wizardClass.openWizardModal(wizardData);
		});
	}

	// Build the main frame section layout
	const sectionRootNode = E('div', {
		'class': 'cbi-section',
		'id': 'modification_section_' + instance_id,
		'style': 'margin:40px 0; border:1px solid var(--border-color-medium, #cbd5e1); border-radius:6px; background:transparent; overflow:hidden; position:relative;'
	}, [
		E('div', {
			'style': 'display:flex; align-items:center; justify-content:space-between; background:var(--background-color-medium, #f4f4f5); border-bottom:1px solid var(--border-color-medium, #cbd5e1); padding:10px 20px; margin:0;'
		}, [
			E('h3', { 'style': 'margin: 0; font-weight: bold; font-size: 16px; border: none; padding: 0;' }, sectionHeadingText),
			E('div', { 'style': 'display: inline-flex; align-items: center;' }, [nameInput, checkboxContainer])
		]),

		// BODY WRAPPER: Implements a clean unified padding area exclusively for the lower configuration elements
		E('div', { 'style': 'padding: 20px;' }, [

			renderPortAlertBox(instObj, role, appData),

			renderKeysBox(instance_id, displayId, role, ovpnProfileBtn, keygenBtn, appData),

			renderConfigEditor(instance_id, txtArea, saveBtn),

			E('div', { 'style': 'width:100%; display:block; margin-top:20px; overflow:hidden;' }, [saveBtn, cNotice, dNotice, delBtn])
		])
	]);

	sectionRootNode.setAttribute('data-original-content', confContent);

	saveBtn.addEventListener('click', function (ev) {
		ev.preventDefault();
		const freshOriginalText = sectionRootNode.getAttribute('data-original-content') || '';
		handleInstanceSave(instance_id, instObj, role, txtArea, saveBtn, cNotice, freshOriginalText, sectionRootNode, appData);
	});
	saveBtn.style.display = 'none';

	delBtn.addEventListener('click', function (ev) {
		ev.preventDefault();
		handleInstanceDeletion(instance_id, displayId, delBtn, dNotice, sectionRootNode);
	});

	return sectionRootNode;
};

/**
 * Subroutine of addNewInstance to create a new OpenVPN instance and its firewall rules safely.
 */
const createInstance = async function (newInstanceItem, appData, wizardParams) {

	// Use await to generate all initial configuration and key assets lineary
	await syncInstanceFiles(newInstanceItem, appData, wizardParams);

	// Add the new section row identity block into the local UCI cache matrix
	L.uci.add(CFG.CMD.openvpn, CFG.CMD.openvpn, newInstanceItem.id);

	let targetEnabledState = '0';
	if (wizardParams) {
		targetEnabledState = '1';
	} else if (appData.ovpnUciSections) {
		if (appData.ovpnUciSections.length === 0) {
			targetEnabledState = '1';
		} else {
			if (isAnyInstanceEnabled(appData.ovpnUciSections)) {
				targetEnabledState = '1';
			}
		}
	}

	L.uci.set(CFG.CMD.openvpn, newInstanceItem.id, 'enabled', targetEnabledState);
	L.uci.set(CFG.CMD.openvpn, newInstanceItem.id, 'role', newInstanceItem.role);
	L.uci.set(CFG.CMD.openvpn, newInstanceItem.id, 'config', CFG.FILE.dir_cfg + newInstanceItem.id + '.conf');

	if ((wizardParams) && (wizardParams.displayName)) {
		L.uci.set(CFG.CMD.openvpn, newInstanceItem.id, 'displayname', wizardParams.displayName);
	}

	// Push the item into appData.instances right before saving to keep browser RAM synchronous
	if (Array.isArray(appData.instances)) {
		appData.instances.push(newInstanceItem);
	}
	let serverSiteToSite = false;
	let smartFirewallEnabled = false;
	if (newInstanceItem.role === OPENVPN.ROLE.SERVER) {
		// check if 'setenv sitetosite on'
		serverSiteToSite = appData.statusClass.parseSiteToSite(newInstanceItem.confContent);

		// check if 'setenv ovpnfirewall on'
		smartFirewallEnabled = appData.statusClass.parseSmartFirewall(newInstanceItem.confContent);
		await updateSmartFirewallFile(newInstanceItem.id, newInstanceItem.port, newInstanceItem.proto);

	}

	// create firewall rules of new isntance
	await syncInstanceFirewallRule(newInstanceItem.id, newInstanceItem, newInstanceItem.role, newInstanceItem.port, newInstanceItem.proto, serverSiteToSite, smartFirewallEnabled, appData, newInstanceItem.confContent);

	// if necessary sort uci openvpn instance enties (e.g. openvpn.instance2 openvpn.instance1 -> openvpn.instance1 openvpn.instance2)
	ovpnServiceStartStop.uciSort = true;

	L.uci.save();
}

/**
 * Core routine to create a new OpenVPN instance and its firewall rules safely.
 */
const addNewInstance = async function (roleType, appData, wizardParams, optionalShowBtnCancel) {

	const nextNum = getNextInstanceNumber(appData);
	const nextId = CFG.ID.instance + nextNum;
	const devName = appData.statusClass.getDevName(nextId, nextNum, true);

	const newInstanceItem = Object.assign({}, appData.statusClass.INSTANCE_TEMPLATE, {
		id: nextId,
		instNum: nextNum,
		devName: devName,
		role: roleType,
		connectedClients: []
	});

	// Trigger the automated key allocation modal for ALL server installations
	if ((newInstanceItem.role === OPENVPN.ROLE.SERVER) || ((wizardParams) && (wizardParams.role === OPENVPN.ROLE.SERVER))) {

		const callbacks = ({
			openWizardBtnClick: openWizardBtnClick,
			rpcFileCallbacks: rpcFileCallbacks,
			uciSaveApplyRestart: uciSaveApplyRestart,
			createInstance: createInstance,
		});

		appData.keygenClass.openAutomatedPostKeyGenModal(newInstanceItem, appData, wizardParams, callbacks, optionalShowBtnCancel);

	} else {
		await createInstance(newInstanceItem, appData, wizardParams);
		uciSaveApplyRestart(newInstanceItem.id);
	}

	return newInstanceItem.id;
};

/**
 * Opens a window to import a client profile or use default files
 */
const openManualClientImportModal = function (appData) {

	const infoText = E('div', { 'class': 'cbi-section-descr', 'style': 'margin-bottom:15px; line-height:1.5;' },
		TXT.KEY.client_connection_needs_server_key_and_config
	);

	const importBtn = E('button', {
		'class': 'cbi-button cbi-button-action important',
		'style': 'margin-right:10px;'
	}, TXT.MSG.import_profile);

	const fallbackBtn = E('button', {
		'class': 'cbi-button cbi-button-neutral',
		'style': 'margin-right:10px;'
	}, TXT.BTN.use_fallback);

	const cancelBtn = E('button', {
		'class': 'cbi-button cbi-button-neutral'
	}, TXT.BTN.cancel);

	const nextNum = getNextInstanceNumber(appData);

	// Reverts to the default standard loopback configuration
	const loadDefaultFallbackKeys = function () {
		L.ui.hideModal();
		addNewInstance(OPENVPN.ROLE.CLIENT, appData, null);
	};

	// Pure cancel event: just closes the modal layout without creating any instance
	const handlePureCancel = function () {
		L.ui.hideModal();
	};

	// Attach the asynchronous click handler to manage file processing safely
	importBtn.addEventListener('click', function () {
		const wizardData = Object.assign({}, appData.wizardClass.WIZARD_DATA_TEMPLATE, {
			appData: appData,
			addNewInstanceCallback: addNewInstance,
			networkCallbacks: networkCallbacks,
			uciSaveApplyRestartCallback: uciSaveApplyRestart,
			importOvpnClientProfileCallback: importOvpnClientProfile,
			instanceNumber: nextNum,
			forcedScenario: OPENVPN.SCENARIO.SITE_TO_SITE_CLIENT
		});
		appData.wizardClass.openWizardModal(wizardData, false);
	});

	// Connect the buttons to their independent functions
	fallbackBtn.addEventListener('click', loadDefaultFallbackKeys);
	cancelBtn.addEventListener('click', handlePureCancel);

	// Render the complete client import window layout
	L.ui.showModal(ICON.IMPORT + TXT.MSG.import_openvpn_connect_client_profile, [
		E('div', { 'class': 'cbi-map' }, [
			E('div', { 'class': 'cbi-section' }, [
				infoText,
				E('div', { 'style': 'text-align:right; margin-top:20px; border-top:1px solid var(--border-color-medium, #cbd5e1); padding-top:12px;' }, [
					importBtn,
					fallbackBtn,
					cancelBtn
				])
			])
		])
	]);
};

/**
 * Renders the creation box containing buttons to add new profiles
 */
const renderInstanceCreationBox = function (appData) {
	const addServerBtn = E('button', { 'class': 'btn cbi-button cbi-button-positive important' }, TXT.BTN.add_server);
	const addClientBtn = E('button', { 'class': 'btn cbi-button cbi-button-action important' }, TXT.BTN.add_client);

	const addServerNotice = E('span', { 'class': 'text-danger', 'style': 'font-weight:bold; margin-left:10px; display:none;' }, ICON.WARNING + ' ' + TXT.BTN.click_save_apply);
	const addClientNotice = E('span', { 'class': 'text-danger', 'style': 'font-weight:bold; margin-left:10px; display:none;' }, ICON.WARNING + ' ' + TXT.BTN.click_save_apply);

	// Start the regular server creation flow when clicking the server button
	addServerBtn.addEventListener('click', function (ev) {
		ev.preventDefault();
		addNewInstance(OPENVPN.ROLE.SERVER, appData, null, true);
	});

	// Start the import modal flow directly when clicking the client button
	addClientBtn.addEventListener('click', function (ev) {
		ev.preventDefault();
		openManualClientImportModal(appData);
	});

	return E('div', { 'class': 'cbi-map' }, [
		E('div', { 'class': 'cbi-section' }, [
			E('h3', { 'style': 'font-weight:bold;' }, TXT.INFO.title_instance),
			E('div', { 'style': 'margin-top:10px; display:flex; align-items:center; flex-wrap:wrap; gap:10px;' }, [
				E('div', { 'style': 'display:inline-flex; align-items:center;' }, [addServerBtn, addServerNotice]),
				E('div', { 'style': 'display:inline-flex; align-items:center;' }, [addClientBtn, addClientNotice])
			])
		])
	]);
};


/**
 * --- FIREWALL & LOG VIEW  ---
 */


/**
 * Define reloadFirewall with luci_app_openvpn_plus firewallservice
 */
const reloadFirewall = {
	Request: false,
	checkRequest: function () {
		if (this.Request === true) {
			this.Request = false;
			// DETACHED PRIVILEGED TRIGGER: Fires parallel to the main LuCI execution thread
			setTimeout(async function () {
				const res = await luci_app_openvpn_plus([CFG.LIBEXEC.firewallservice, CFG.CMD.restart]);
				if (res.length === 0) {
					console.error('Asynchronous background firewall service call failed: ' + CFG.LIBEXEC.luci_app_openvpn_plus + ' ' + CFG.LIBEXEC.firewallservice + ' ' + CFG.CMD.restart);
				}
			}, 0);
		}
		return;
	}
};

/**
 * Configures firewall zones, forwardings, and static site-to-site forwarding loops without wiping sections
 */
const syncInstanceFirewallRule = async function (instance_id, instObj, role, customPort, customProto, serverSiteToSite, smartFirewallEnabled, appData, conf) {

	// Inbound WAN rule blocks (Server only)
	const fwRuleSection = CFG.ID.fw_openvpn_rule + instance_id;
	const fwIncludeSection = CFG.ID.fw_openvpn_inc + instance_id;

	// Dedicated block for the custom static site-to-site script injection
	const fwS2SIncludeSection = CFG.ID.fw_openvpn_s2s_inc + instance_id;

	// Site-to-site zone and forwarding blocks
	const fwZoneSection = CFG.ID.fw_openvpn_zone + instance_id;
	const fwForwardLanSection = CFG.ID.fw_openvpn_fwd_lan + instance_id;
	const fwForwardVpnSection = CFG.ID.fw_openvpn_fwd_vpn + instance_id;

	// Track if any change was actually made to the configuration
	let hasChanges = false;

	// Helper function to safely set UCI values only if they are different
	const safeUciSet = function (config, section, option, value) {
		const currentValue = L.uci.get(config, section, option);
		if (String(currentValue) !== String(value)) {
			L.uci.set(config, section, option, value);
			hasChanges = true;
		}
	};

	// Helper function to safely ensure a section exists with the correct type
	const safeUciAdd = function (config, type, section) {
		const exists = L.uci.get(config, section);
		if (!exists) {
			L.uci.add(config, type, section);
			hasChanges = true;
		}
	};

	// Helper function to safely remove a section only if it exists
	const safeUciRemove = function (config, section) {
		const exists = L.uci.get(config, section);
		if (exists) {
			L.uci.remove(config, section);
			hasChanges = true;
		}
	};

	try {
		const deviceName = instObj.devName;
		const zoneName = 'vpn_zone_' + instance_id;

		// --- SECTION 1: SERVER SPECIFIC INBOUND WAN ROLES ---
		if (role === OPENVPN.ROLE.SERVER) {
			let targetPort = customPort;
			if (!targetPort || isNaN(targetPort)) {
				targetPort = appData.statusClass.calcPortFromId(instance_id);
			}

			let targetProto = customProto;
			if (!targetProto || (targetProto !== OPENVPN.PROTO.UDP && targetProto !== OPENVPN.PROTO.TCP)) {
				targetProto = OPENVPN.PROTO.UDP;
			}

			// Ensure the inbound WAN port rule exists and matches target metrics
			safeUciAdd(CFG.CMD.firewall, 'rule', fwRuleSection);
			safeUciSet(CFG.CMD.firewall, fwRuleSection, 'name', CFG.ID.fw_openvpn_server + instance_id);
			safeUciSet(CFG.CMD.firewall, fwRuleSection, 'src', 'wan');
			safeUciSet(CFG.CMD.firewall, fwRuleSection, 'dest_port', String(targetPort));
			safeUciSet(CFG.CMD.firewall, fwRuleSection, 'proto', targetProto);
			safeUciSet(CFG.CMD.firewall, fwRuleSection, 'target', 'ACCEPT');

			// Manage the custom Smart Firewall script include block
			if (smartFirewallEnabled === true) {
				safeUciAdd(CFG.CMD.firewall, 'include', fwIncludeSection);
				safeUciSet(CFG.CMD.firewall, fwIncludeSection, 'type', 'script');
				safeUciSet(CFG.CMD.firewall, fwIncludeSection, 'fw4_compatible', '1');
				safeUciSet(CFG.CMD.firewall, fwIncludeSection, 'enabled', '1');
				safeUciSet(CFG.CMD.firewall, fwIncludeSection, 'path', CFG.FILE.dir_cfg + instance_id + '.nft');
			} else {
				safeUciRemove(CFG.CMD.firewall, fwIncludeSection);
			}
		} else {
			// Remove server specific rules if the instance is now a client
			safeUciRemove(CFG.CMD.firewall, fwRuleSection);
			safeUciRemove(CFG.CMD.firewall, fwIncludeSection);
		}

		// --- SECTION 2: STATIC SITE-TO-SITE ROUTING ---
		let s2sScript = false;
		if (serverSiteToSite === true || role === OPENVPN.ROLE.CLIENT) {
			const remoteSubnets = appData.statusClass.parseRemoteSubnets(conf, role, false);

			if (remoteSubnets && Array.isArray(remoteSubnets) && remoteSubnets.length > 0) {
				const localLan = await getLanIpMask(true);
				const localSubnet = appData.statusClass.netIPCIDR(localLan.ip, localLan.mask);

				let s2sNftContent = '#!/bin/sh\n\n';
				s2sNftContent += '# Automatically generated by luci-app-openvpn-plus - OpenVPN Site-to-Site Firewall Rules\n\n';

				for (let i = 0; i < remoteSubnets.length; i++) {
					const remoteSubnet = remoteSubnets[i];
					if (!remoteSubnet) {
						continue;
					}
					s2sNftContent += 'nft "insert rule inet fw4 forward index 0 iifname br-lan ip daddr ' + remoteSubnet + ' counter accept comment \\"luci-app-openvpn-plus: static s2s outbound forward for ' + instance_id + '\\""\n';
				}

				s2sNftContent += '\n';
				s2sNftContent += 'nft "insert rule inet fw4 forward index 0 iifname ' + deviceName + ' ip daddr ' + localSubnet + ' counter accept comment \\"luci-app-openvpn-plus: static s2s inbound forward for ' + instance_id + '\\""\n';
				s2sNftContent += '\n';

				const s2sScriptPath = CFG.FILE.dir_cfg + instance_id + '.s2s.nft';

				// Try to read the old file content to see if the script actually changed
				let oldScriptContent = '';
				try {
					oldScriptContent = await rpcReadFile(s2sScriptPath);
				} catch {
					oldScriptContent = '';
				}

				// Only write the file to the flash storage if the content is different
				if (String(oldScriptContent).trim() !== s2sNftContent.trim()) {
					await rpcWriteFile(s2sScriptPath, s2sNftContent);
					hasChanges = true;
				}

				// Register the script file inside the firewall configuration tree safely
				safeUciAdd(CFG.CMD.firewall, 'include', fwS2SIncludeSection);
				safeUciSet(CFG.CMD.firewall, fwS2SIncludeSection, 'type', 'script');
				safeUciSet(CFG.CMD.firewall, fwS2SIncludeSection, 'fw4_compatible', '1');
				safeUciSet(CFG.CMD.firewall, fwS2SIncludeSection, 'enabled', '1');
				safeUciSet(CFG.CMD.firewall, fwS2SIncludeSection, 'path', s2sScriptPath);
				s2sScript = true;
			}
		}

		// Remove the site-to-site block if it was not triggered or has no valid subnets
		if (s2sScript === false) {
			safeUciRemove(CFG.CMD.firewall, fwS2SIncludeSection);
		}

		// --- SECTION 3: SYMMETRICAL VPN ZONE & LAN FORWARDING ---
		const networkState = await checkNetworkStructure(appData);

		// Manage the secure firewall zone for the VPN tunnel network device safely
		safeUciAdd(CFG.CMD.firewall, 'zone', fwZoneSection);
		safeUciSet(CFG.CMD.firewall, fwZoneSection, 'name', zoneName);
		safeUciSet(CFG.CMD.firewall, fwZoneSection, 'device', deviceName);
		safeUciSet(CFG.CMD.firewall, fwZoneSection, 'input', 'ACCEPT');
		safeUciSet(CFG.CMD.firewall, fwZoneSection, 'output', 'ACCEPT');
		safeUciSet(CFG.CMD.firewall, fwZoneSection, 'forward', 'ACCEPT');
		safeUciSet(CFG.CMD.firewall, fwZoneSection, 'mtu_fix', '1');

		// Resolve the main local LAN zone safely
		const fwSections = L.uci.sections(CFG.CMD.firewall, 'zone') || [];
		let lanSectionId = null;
		for (let z = 0; z < fwSections.length; z++) {
			if (fwSections[z] && fwSections[z].name === 'lan') {
				lanSectionId = fwSections[z]['.name'];
				break;
			}
		}

		// Set safe LAN masquerading states depending on network boundaries
		if (lanSectionId) {
			if (networkState.apMode === true || networkState.doubleNat === true) {
				safeUciSet(CFG.CMD.firewall, lanSectionId, 'masq', '1');
			} else {
				safeUciSet(CFG.CMD.firewall, lanSectionId, 'masq', '0');
			}
		}

		// Configure the forwarding from LAN to VPN zone safely
		safeUciAdd(CFG.CMD.firewall, 'forwarding', fwForwardLanSection);
		safeUciSet(CFG.CMD.firewall, fwForwardLanSection, 'src', 'lan');
		safeUciSet(CFG.CMD.firewall, fwForwardLanSection, 'dest', zoneName);

		// Configure the forwarding from VPN zone back to LAN safely
		safeUciAdd(CFG.CMD.firewall, 'forwarding', fwForwardVpnSection);
		safeUciSet(CFG.CMD.firewall, fwForwardVpnSection, 'src', zoneName);
		safeUciSet(CFG.CMD.firewall, fwForwardVpnSection, 'dest', 'lan');

		// Only save and request a firewall reload if changes were actually detected
		if (hasChanges === true) {
			L.uci.save();
			reloadFirewall.Request = true;
		}

		return true;

	} catch (err) {
		console.error('Fatal firewall configuration synchronization failed:', err);
		if (hasChanges === true) {
			L.uci.save();
			reloadFirewall.Request = true;
		}
		return false;
	}
};

/**
 * Removes all custom firewall rules and zones for a specific OpenVPN profile safely
 */
const removeInstanceFirewallRule = function (instance_id) {
	let hasChanges = false;

	// Helper function to safely remove a section only if it exists in the tree
	const safeUciRemove = function (config, section) {
		const exists = L.uci.get(config, section);
		if (exists) {
			L.uci.remove(config, section);
			hasChanges = true;
		}
	};

	// Delete the inbound WAN rule blocks if they exist
	safeUciRemove(CFG.CMD.firewall, CFG.ID.fw_openvpn_rule + instance_id);
	safeUciRemove(CFG.CMD.firewall, CFG.ID.fw_openvpn_inc + instance_id);
	safeUciRemove(CFG.CMD.firewall, CFG.ID.fw_openvpn_s2s_inc + instance_id);

	// Delete the site-to-site zone and forwarding blocks completely if they exist
	safeUciRemove(CFG.CMD.firewall, CFG.ID.fw_openvpn_zone + instance_id);
	safeUciRemove(CFG.CMD.firewall, CFG.ID.fw_openvpn_fwd_lan + instance_id);
	safeUciRemove(CFG.CMD.firewall, CFG.ID.fw_openvpn_fwd_vpn + instance_id);

	// Only commit to storage and request a reload if sections were actually deleted
	if (hasChanges === true) {
		L.uci.save();
		reloadFirewall.Request = true;
	}
};

/**
 * Reads and aggregates live packet and byte counters from the custom nftables sub-chain
 */
const getSubChainMetrics = async function (subChainName) {
	// Runs your specialized firewall nft list backend utility safely
	const output = await luci_app_openvpn_plus([CFG.LIBEXEC.firewallnft, 'list', 'chain', 'inet', 'fw4', subChainName]);
	if (output.length > 0) {

		// Matches any counter line ending with either 'reject' or 'drop' (supports both TCP & UDP)
		const counterLines = output.match(/counter packets \d+ bytes \d+ (update|reject|drop)/g) || [];

		let totalPackets = 0;
		let totalBytes = 0;

		counterLines.forEach(function (line) {
			// Captures both numeric groups cleanly using digits (\d+)
			const metrics = line.match(/packets (\d+) bytes (\d+)/);
			if (metrics && metrics[1] && metrics[2]) {
				totalPackets += parseInt(metrics[1], 10);
				totalBytes += parseInt(metrics[2], 10);
			}
		});

		return {
			active: true,
			packets: totalPackets,
			bytes: totalBytes
		};
	}
	return { active: false, packets: 0, bytes: 0 };
};

/**
 * Smart Firewall Filter
 */
const smartFilterContainer = E('div', {}, []);

/**
 * Helper function to calculate the firewall uptime
 */
const getFirewallUptime = async function () {
	try {
		// Read file status of the firewall state file
		const stat = await rpcStatFile('/var/run/fw4.state');

		if (stat && stat.mtime) {
			// Get current time in seconds and calculate difference
			const currentTime = Math.floor(Date.now() / 1000);

			// Protect against time shifts (NTP updates) using Math.abs
			const uptimeSeconds = Math.abs(currentTime - stat.mtime);

			// Calculate days, hours, minutes and seconds
			const days = Math.floor(uptimeSeconds / 86400);
			const hours = Math.floor((uptimeSeconds % 86400) / 3600);
			const minutes = Math.floor((uptimeSeconds % 3600) / 60);
			const seconds = uptimeSeconds % 60;

			if (days > 0) {
				return days + 'd ' + hours + 'h ' + minutes + 'm ' + seconds + 's';
			}
			return hours + 'h ' + minutes + 'm ' + seconds + 's';
		}
	} catch (e) {
		console.error('Failed to read firewall uptime:', e);
	}
	return '';
};

/**
 * Refresh Smart Firewall Filter view
 */
const refreshFirewall = async function (appData) {

	const noSmartFilterElement = E('span', {}, [
		E('strong', {}, ICON.HINT + TXT.FIREWALL.check_traffic_rules), TXT.FIREWALL.network, ICON.ARROW, TXT.FIREWALL.firewall,
		E('a', { 'href': L.url('admin/network/firewall/rules'), 'style': 'font-weight:bold; color:var(--primary-color-high, #1976d2); text-decoration:none;' }, ICON.FORWARD + TXT.FIREWALL.traffic_rules)
	]);

	// Check if at least one running server instance has the smart firewall flag set to true
	let isSmartFirewallInUse = false;
	const metricPromises = [];

	appData.instances.forEach(function (inst) {
		if (inst && inst.isRunning === true && inst.smartFirewall === true) {
			isSmartFirewallInUse = true;
			// Push active query promise into parallel execution queue
			metricPromises.push(getSubChainMetrics(`ovpn_filter_${inst.id}`));
		}
	});

	if (isSmartFirewallInUse) {
		try {
			// Await all parallel sub-chain kernel reads and the uptime file at the same time
			const [metricsArray, uptimeString] = await Promise.all([
				Promise.all(metricPromises),
				getFirewallUptime()
			]);

			let aggregatedPackets = 0;
			let aggregatedBytes = 0;

			// Sum up packets and bytes from all active instances
			metricsArray.forEach(function (metric) {
				if (metric) {
					aggregatedPackets += metric.packets || 0;
					aggregatedBytes += metric.bytes || 0;
				}
			});

			const filtered = (aggregatedPackets > 0) ? TXT.FIREWALL.filtered + ': ' + aggregatedPackets + ' ' + TXT.FIREWALL.packets + ' (' + appData.statusClass.formatStatusBytes(aggregatedBytes) + ')' + '\n' : '';
			const uptime = uptimeString ? TXT.FIREWALL.protected_since + ': ' + uptimeString + '\n' : '';
			const tooltipText =
				ICON.SHIELD + TXT.FIREWALL.smart_filewall + ':' + '\n' +
				filtered +
				uptime + '\n' +
				ICON.INFO + TXT.FIREWALL.smart_filewall_tooltip;

			// Create the active status element with the full tooltip
			const smartFilterElement = E('span', {
				'title': tooltipText,
				'style':
					'display:inline-block; font-size:12px; padding:4px 10px; border-radius:4px; cursor:help; ' +
					'background:color-mix(in srgb, var(--primary-color-high, #1976d2) 10%, transparent); ' +
					'border:1px solid color-mix(in srgb, var(--primary-color-high, #1976d2) 30%, transparent); ' +
					'color:color-mix(in srgb, var(--text-color-medium, #71717a) 85%, #0055ff);'
			}, [
				E('strong', { 'style': 'font-weight:bold' }, [ICON.SHIELD + TXT.FIREWALL.smart_filewall + ': ']),
				E('strong', { 'style': 'color:var(--primary-color-high, #1976d2); font-weight:bold' }, [TXT.FIREWALL.ACTIVE]),
			]);

			// Update the container DOM element
			smartFilterContainer.innerHTML = '';
			smartFilterContainer.appendChild(smartFilterElement);
			return;

		} catch (err) {
			console.error('Firewall live statistics core update cycle dropped:', err);
		}
	}

	// If no instance uses the smart firewall, show standard LuCI firewall links
	smartFilterContainer.innerHTML = '';
	smartFilterContainer.appendChild(noSmartFilterElement);
	return;
};

/**
 * Renders the firewall information box displaying active ports.
 */
const renderFirewallInfoBox = function (appData) {
	const customPortsMap = {};
	const allRules = L.uci.sections(CFG.CMD.firewall, 'rule') || [];

	// Scan all active openvpn firewall sections dynamically
	allRules.forEach(function (r) {
		const sectionName = r['.name'] || '';
		if (sectionName.indexOf('openvpn_') === 0 || sectionName.indexOf('openvpn_rule_') === 0) {
			const pVal = L.uci.get(CFG.CMD.firewall, sectionName, 'dest_port');
			let protoVal = L.uci.get(CFG.CMD.firewall, sectionName, 'proto') || OPENVPN.PROTO.UDP;

			if (pVal) {
				const pNum = parseInt(pVal, 10);
				if (!isNaN(pNum)) {
					protoVal = String(protoVal).toUpperCase();
					// Store combined proto + port token to handle dual-stacks seamlessly
					customPortsMap[protoVal + ' ' + pNum] = true;
				}
			}
		}
	});

	const activeRulesArray = Object.keys(customPortsMap).sort();
	const firewallContainer = E('fieldset', {
		'class': 'class_fieldset',
		'style': 'margin-top:5px; padding:15px; border:1px solid var(--border-color-medium, #cbd5e1); border-radius:4px; background:var(--background-color-medium, #f4f4f5);'
	}, [
		E('legend', { 'style': 'font-weight:bold; font-size:13px; padding:0 8px;' }, TXT.FIREWALL.firewall_info),
		E('p', { 'style': 'margin:0; font-size:12px; line-height:1.6;' }, [
			E('strong', {}, ICON.CHECK + TXT.FIREWALL.automated_zone_setup), TXT.FIREWALL.secure_firewall_for_all,
			E('code', { 'title': TXT.FIREWALL.openvpn_tunnel_interface, 'style': 'cursor:help; border-bottom:1px dashed var(--border-color-medium, #cbd5e1);' }, 'tun+'), TXT.FIREWALL.devices_autocreated,
			E('div', { 'style': 'margin-top: 8px;' }),
			E('strong', {}, ICON.CHECK + TXT.FIREWALL.inbound_access), TXT.FIREWALL.wan_ports, activeRulesArray.length > 0 ? E('code', {}, activeRulesArray.join(', ')) : E('code', {}, 'None'), TXT.FIREWALL.auto_open_secure_connection,
			E('div', { 'style': 'margin-top: 8px;' }),
			smartFilterContainer
		])
	]);
	return firewallContainer;
};

/**
 * Create the RPC call to run system commands.
 */
const logreadNativeRpc = L.rpc.declare({
	object: 'file',
	method: 'exec',
	params: ['command', 'params']
});

/**
 * Read OpenVPN system logs.
 */
const callLogRead = async function (options) {
	const pattern = (options && options.pattern) ? options.pattern : CFG.ID.openvpn_logread;
	const execRes = await L.resolveDefault(logreadNativeRpc('/sbin/logread', ['-e', pattern]), {});
	if (execRes && typeof execRes === 'object' && typeof execRes.stdout === 'string') {
		return execRes.stdout.trim();
	}
	return '';
};

/**
 * Filter for OpenVPN system logs
 */
const logFilter = {
	filters: [],
	showSmartFirewall: false,
	logCache: null,
	setup: function (appData) {
		// 1. Always push the standard basic filters
		this.filters.push('--script-security');
		this.filters.push('Using AF_INET');
		this.filters.push('pool size limits');

		let enableFilter = false;

		// 2. Check if at least one running instance wants the log filter
		if (appData && Array.isArray(appData.instances)) {
			appData.instances.forEach(function (inst) {
				if (inst && inst.isRunning === true && inst.useLogFilter === true) {
					enableFilter = true;
				}
			});
		}

		// 3. If enabled, push the custom cosmetic warning filters
		if (enableFilter === true) {
			// Mobile clients
			this.filters.push('Bad encapsulated packet length from peer');
			// DCO filter
			this.filters.push('ovpn_handle_peer: received data for a non-existing peer');
			this.filters.push('dco_read_and_process: netlink reports blocking read');
			this.filters.push('sitnl_send: rtnl: generic error (-17): File exists');
		}
	},
	check: function (line) {
		let shouldDrop = false;

		this.filters.forEach(function (filter) {
			if (line.indexOf(filter) !== -1) {
				shouldDrop = true;
				return;
			}
		});

		return shouldDrop;
	}
};

/**
 * Applies syntax highlighting to individual log entries using strict regular expressions.
 */
const colorizeLogLines = function (text) {
	if (!text) {
		return '';
	}

	return text.split('\n').map(function (line) {
		let cleanLine = line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

		if (logFilter.check(cleanLine) == true) {
			return null;
		}

		// 0. Show firewall log entries in a subtle light gray/white
		if (/openvpn.*\[firewall\]/i.test(cleanLine)) {
			return '<span style="color:#94a3b8; font-weight:normal; opacity: 0.85;">' + cleanLine + '</span>';
		}

		// 1. Show openvpn-luci script messages in purple color (highest priority)
		if (/openvpn-luci/i.test(cleanLine)) {
			return '<span style="color:#a855f7; font-weight:bold;">' + cleanLine + '</span>';
		}

		// 2. Show critical errors and bad statuses in red color
		if (/error|failed|auth_failed|rejected/i.test(cleanLine)) {
			return '<span style="color:#f87171; font-weight:bold;">' + cleanLine + '</span>';
		}

		// 3. Show system warnings and notes in orange color
		if (/warning|warn|note/i.test(cleanLine)) {
			return '<span style="color:#f97316; font-weight:bold;">' + cleanLine + '</span>';
		}

		// 4. Show connection attempts and handshakes in green color
		if (/attempting/i.test(cleanLine)) {
			return '<span style="color:#10b981; font-weight:bold;">' + cleanLine + '</span>';
		}

		// 5. Show successful connections and status updates in blue color
		if (/initiated|established|completed|success/i.test(cleanLine)) {
			return '<span style="color:#3b82f6; font-weight:bold;">' + cleanLine + '</span>';
		}

		return cleanLine;
	}).filter(function (line) {
		// Remove empty null rows safely to keep ESLint happy
		return line !== null;
	}).join('\n');
};

/**
 * Filters the visible logs by saving a timestamp cutoff in session storage.
 */
const handleLogFilter = async function (clearLogBtn, logTextArea) {
	clearLogBtn.disabled = true;
	clearLogBtn.textContent = ICON.LOADING + TXT.INFO.clearing;

	// 1. Wait for the log data from the server
	const plainText = await callLogRead({ pattern: CFG.ID.openvpn_logread });

	if (plainText) {
		const lines = String(plainText).trim().split('\n');
		if (lines.length > 0) {
			const lastEntry = lines[lines.length - 1];
			if (lastEntry) {
				sessionStorage.setItem(CFG.ID.openvpn_log_stamp, lastEntry.substring(0, 24));
			}
		}
	}

	// Reset the global RAM cache variable instantly when log is cleared
	logFilter.logCache = null;

	logTextArea.innerHTML = '<span style="color:#94a3b8; font-style:italic;">' + TXT.MSG.no_vpn_log + '</span>';
	clearLogBtn.textContent = ICON.SUCCESS + TXT.INFO.log_cleared;

	// 2. Wait 1.5 seconds to reset the button text
	setTimeout(function () {
		clearLogBtn.disabled = false;
		clearLogBtn.textContent = TXT.INFO.log_clear;
	}, 1500);
};

/**
 * Renders the terminal box for the OpenVPN protocol log output.
 */
const renderLogBox = function (logLines, appData) {

	// Scrollable terminal div with dynamic HTML coloring
	const logTextArea = E('div', {
		'id': 'openvpn_terminal_box',
		'class': 'cbi-input-textarea',
		'style': 'display:block; width:100%; height:240px; font-family:var(--font-monospace, monospace); font-size:12px; background:#222 !important; color:#fff !important; padding:15px; border-radius:4px; border:1px solid var(--border-color-medium, #cbd5e1); overflow:auto; white-space:pre; text-shadow:none !important; box-sizing:border-box;'
	});

	logFilter.setup(appData);

	// Colorize the initial log stream
	logTextArea.innerHTML = logLines ? colorizeLogLines(logLines) : '<span style="color:#94a3b8; font-style:italic;">' + TXT.MSG.no_vpn_log + '</span>';

	const clearLogBtn = E('button', {
		'id': 'openvpn_clear_log_btn',
		'class': 'btn cbi-button cbi-button-remove',
		'style': 'margin: 0;' // Margin cleared since container handles spacing
	}, TXT.INFO.log_clear);

	clearLogBtn.addEventListener('click', function (ev) {
		ev.preventDefault();
		handleLogFilter(clearLogBtn, logTextArea);
	});

	const fwCheckboxInput = E('input', {
		'type': 'checkbox',
		'id': 'cb_show_fw_logs',
		'style': 'margin-right: 6px; cursor: pointer; width: 16px; height: 16px; vertical-align: middle;'
	});

	fwCheckboxInput.addEventListener('change', function (ev) {
		logFilter.showSmartFirewall = ev.target.checked;
		refreshLog(appData);
	});

	const fwCheckboxLabel = E('label', {
		'for': 'cb_show_fw_logs',
		'style': 'display: inline-flex; align-items: center; cursor: pointer; font-size: 13px; font-weight: bold; user-select: none;'
	}, [fwCheckboxInput, E('span', {}, ['Show Smart Firewall drops'])]);

	// Stretches across the full width, aligning button left and checkbox right on the exact same height lane
	const logActionRow = E('div', {
		'style': 'display: flex; align-items: center; justify-content: space-between; width: 100%; margin-top: 10px; box-sizing: border-box;'
	}, [
		clearLogBtn,
		fwCheckboxLabel
	]);

	// 1. Create the content wrapper for logs (Hidden by default)
	const logContentContainer = E('div', {
		'id': 'openvpn_log_container',
		'style': 'padding:0 2px; display:none; margin-top:5px; width:100%; box-sizing:border-box;'
	}, [
		logTextArea,
		logActionRow // Injected the flex-row instead of single items
	]);

	// 2. Create a dynamic text arrow indicator to show the open/close state
	const toggleArrow = E('span', {
		'style': 'margin-right:8px; font-size:11px; cursor:pointer; user-select:none;'
	}, '▶ ');

	const inlineSummaryLine = E('div', {
		'style': 'width:100%; display:block; font-size:11px; font-family:var(--font-monospace, monospace); color:color-mix(in srgb, var(--text-color-medium, #71717a) 85%, #0055ff); padding:4px 2px; margin-bottom:10px; white-space:normal; word-break:break-all; font-style:italic;'
	}, '▪ ' + TXT.MSG.system_logs);

	// 3. Assemble the interactive clickable title bar header
	const clickableTitle = E('legend', {
		'style': 'font-weight:bold; font-size:13px; padding:0 8px; cursor:pointer; user-select:none;',
		'click': function () {
			const isHidden = (logContentContainer.style.display === 'none');
			if (isHidden) {
				logContentContainer.style.display = 'block';
				inlineSummaryLine.style.display = 'none';
				toggleArrow.textContent = '▼ ';

				// Dynamically calculate the parent width to force precise horizontal scrollbars
				const parentNode = document.getElementById('system_log_section_node');
				if (parentNode) {
					// Subtract 40px to account for the fieldset padding (15px left/right) and margins safely
					const availableWidth = parentNode.offsetWidth - 40;
					if (availableWidth > 0) {
						logTextArea.style.maxWidth = availableWidth + 'px';
					}
				}

				refreshLog(appData);

				// Automatically scroll down to reveal the newest logs when opening
				setTimeout(function () {
					const obj = document.getElementById('openvpn_terminal_box');
					if (obj) obj.scrollTop = obj.scrollHeight;
				}, 100);
			} else {
				logContentContainer.style.display = 'none';
				inlineSummaryLine.style.display = 'block';
				toggleArrow.textContent = '▶ ';
			}
		}
	}, [
		toggleArrow,
		TXT.INFO.title_log
	]);

	// 4. Return the finalized structural fieldset layout (Matches renderConfigEditor style)
	return E('div', { 'class': 'cbi-map', 'id': 'system_log_section_node', 'style': 'margin-bottom:25px; width:100%; box-sizing:border-box;' }, [
		E('div', { 'class': 'cbi-section' }, [
			E('fieldset', {
				'class': 'cbi-section-fieldset',
				'style': 'margin-bottom:0px; padding:15px; border:1px solid var(--border-color-medium, #cbd5e1); border-radius:4px; background:transparent; width:100%; box-sizing:border-box;'
			}, [
				clickableTitle,
				E('div', { 'class': 'cbi-section-node', 'style': 'padding:0 5px; width:100%; box-sizing:border-box;' }, [
					logContentContainer,
					inlineSummaryLine // Stays visible until expanded
				])
			])
		])
	]);
};

/**
 * Filters log lines based on the session storage timestamp, hide entries from IPs that were already blocked by the firewall.
 */
const parseLogLines = function (appData) {
	if (!appData || !appData.logread) {
		return '';
	}

	let allLines = String(appData.logread).trim().split('\n');
	const targetStamp = sessionStorage.getItem(CFG.ID.openvpn_log_stamp);

	// Step A: Find the correct timestamp in the log lines
	if (targetStamp) {
		let allowedIdx = -1;
		for (let j = allLines.length - 1; j >= 0; j--) {
			if (allLines[j].indexOf(targetStamp) === 0) {
				allowedIdx = j;
				break;
			}
		}
		if (allowedIdx !== -1) {
			allLines = allLines.slice(allowedIdx + 1);
		}
	}

	// Debug: show all logs of blocked IP
	// return allLines.join('\n');

	// Step B: Search all lines to find blocked IP addresses
	const blockedIPs = [];
	allLines.forEach(function (line) {
		// Check if the line comes from the firewall
		if (/openvpn.*\[firewall\]/i.test(line)) {
			// Find the IP address after SRC=
			const match = line.match(/SRC=([0-9a-fA-F.:]+)/);
			if (match && match[1]) {
				const ip = match[1];
				// Add the IP to our list if it is not there yet
				if (blockedIPs.indexOf(ip) === -1) {
					blockedIPs.push(ip);
				}
			}
		}
	});

	// Step C: Filter the log lines and remove bad entries
	return allLines.filter(function (line) {
		const isFirewallLog = /openvpn.*\[firewall\]/i.test(line);

		// If it is a firewall log, look at the hideLogsFirewall option
		if (isFirewallLog) {
			return logFilter.showSmartFirewall;
		}

		// If the line contains a blocked IP, delete the line
		for (let i = 0; i < blockedIPs.length; i++) {
			if (line.indexOf(blockedIPs[i]) !== -1) {
				return false;
			}
		}

		// Keep all other good log lines
		return true;
	}).join('\n');

};

/**
 * Asynchronously requests, processes, and renders the colorized OpenVPN system log stream.
 */
const refreshLog = async function (appData) {
	const terminal = document.getElementById('openvpn_terminal_box');
	const clearBtn = document.getElementById('openvpn_clear_log_btn');
	const logContainer = document.getElementById('openvpn_log_container');

	// Stop if the elements are missing or if the clear button is busy
	if (!terminal || (clearBtn && clearBtn.disabled) || (logContainer && logContainer.style.display === 'none')) {
		return;
	}

	// 1. Wait for the log data from the server
	const plainText = await callLogRead({ pattern: CFG.ID.openvpn_logread });

	// Save the text inside the appData object
	appData.logread = plainText || '';

	// Filter and parse the new log lines
	const updatedLines = parseLogLines(appData);
	const cleanLines = (updatedLines || '').trim();

	if (cleanLines !== '') {
		// Only update the HTML if the logs actually changed
		if (cleanLines !== logFilter.logCache) {
			logFilter.logCache = cleanLines;
			terminal.innerHTML = colorizeLogLines(updatedLines);
		}
	} else {
		// Show an empty log message if there are no lines
		if (logFilter.logCache !== null) {
			logFilter.logCache = null;
			terminal.innerHTML = '<span style="color:color-mix(in srgb, var(--text-color-medium, #71717a) 85%, #0055ff); font-style:italic;">' + TXT.MSG.no_active_log_entries + '</span>';
		}
	}
};


/**
 * --- LOCK SCREEN  ---
 */

/**
 * Key Loading Overlay Container
 */
let startupLockOverlay = null;

/**
 * Array mapping configuration files to their respective DOM IDs and translation texts.
 */
const KEY_FILE_MAP = [
	{ id: 'startup_lock_key_ca', label: TXT.KEY.ca, filename: CFG.FILE.ca_def_crt },
	{ id: 'startup_lock_key_server_crt', label: TXT.KEY.server_crt, filename: CFG.FILE.server_def_crt },
	{ id: 'startup_lock_key_server_key', label: TXT.KEY.server_key, filename: CFG.FILE.server_def_key },
	{ id: 'startup_lock_key_client_crt', label: TXT.KEY.client_crt, filename: CFG.FILE.client_def_crt },
	{ id: 'startup_lock_key_client_key', label: TXT.KEY.client_key, filename: CFG.FILE.client_def_key },
	{ id: 'startup_lock_key_dh', label: TXT.KEY.dh, filename: CFG.FILE.dh_def_pem },
	{ id: 'startup_lock_key_server_tls', label: TXT.KEY.server_tls, filename: CFG.FILE.server_def_tls2 },
	{ id: 'startup_lock_key_client_tls', label: TXT.KEY.client_tls, filename: CFG.FILE.client_def_tls2 }
];

/**
 * Renders the loading overlay for the initial default keys generation.
 */
const renderDefaultKeysOverlay = function (keysReady) {
	const content = [
		TXT.KEY.keygen_wait, E('br'),
		TXT.MSG.process_take_few_minutes, E('br'), E('br')
	];
	KEY_FILE_MAP.forEach(function (item) {
		content.push(
			E('div', {
				'id': item.id,
				'style': 'font-weight:normal; transition: all 0.3s ease;'
			}, [
				item.label + ' (' + item.filename + ')... '
			])
		);
	});
	return E('div', {
		'id': 'startup_lock_overlay_panel',
		'style': 'position:absolute; top:35px; left:0; width:100%; height:100%; padding:30px 15px; background: color-mix(in srgb, var(--background-color-high, #ffffff) 90%, transparent); z-index:9999; display:' + (keysReady ? 'none' : 'flex') + '; flex-direction:column; align-items:center; justify-content:flex-start; border-radius:4px;'
	}, [
		E('img', {
			'src': CFG.FILE.loading_img,
			'style': 'width:64px; height:32px; margin-bottom:15px; vertical-align:middle;'
		}),
		E('h3', { 'style': 'margin:0 0 10px 0; font-weight:bold; text-shadow:none !important;' }, TXT.KEY.keygen_in_progress),

		E('p', { 'style': 'margin:0; font-style:normal; font-size:13px; text-align:center; line-height:1.6;' },
			content
		)
	]);
};

/**
 * Checks the existence of each key file and updates the overlay UI items dynamically.
 */
const checkIndividualKeysProgress = async function () {
	const statPromises = [];

	// Queue parallel file system checks for maximum efficiency
	KEY_FILE_MAP.forEach(function (item) {
		statPromises.push(rpcStatFile(CFG.FILE.dir_keys + item.filename));
	});

	try {
		const stats = await Promise.all(statPromises);

		stats.forEach(function (fileStat, index) {
			const configItem = KEY_FILE_MAP[index];
			const element = document.getElementById(configItem.id);

			// If DOM element exists and file is present in the filesystem
			if (element && fileStat && fileStat.size > 0) {
				element.innerHTML = configItem.label + ' (' + configItem.filename + ')... <strong>ok</strong>';
				// Apply the bold blue color styling
				element.style.color = 'var(--primary-color-high, #1976d2)';
				element.style.fontWeight = 'bold';
			}
		});
	} catch (err) {
		console.error('Failed to update live key generation progress items:', err);
	}
};

/**
 * Checks the default key generation lock state: 'CFG.LIBEXPERIMENT.luci_app_openvpn_plus -> generate_default_keys()'
 */
const checkDefaultKeysState = function (appData) {
	return rpcStatFile(CFG.FILE.openvpn_keygen_lock).then(function (lockStat) {
		// If the lock file is gone, keys are guaranteed to be fully written and ready
		appData.keysReady = !lockStat;
	});
};

/**
 * Polls the system startup state until default crypto keys are fully ready.
 */
const pollDefaultKeysReady = async function (appData) {

	try {
		// Wait for the background key state check to resolve
		await checkDefaultKeysState(appData);

		// 1. If background generator lock still exists, maintain the lock screen
		if (!appData.keysReady) {
			if (startupLockOverlay) {
				startupLockOverlay.style.display = 'flex';
				// Trigger live filesystem progress tracking check during polling loop
				await checkIndividualKeysProgress();
			}
			return;
		}

		// 2. Keys are ready - check if a reload is actually required
		if (startupLockOverlay) {
			if (startupLockOverlay.style.display === 'flex') {
				startupLockOverlay.style.display = 'none';
				L.Poll.stop();
				// window.location.reload();
				return;
			}
			startupLockOverlay.style.display = 'none';
		}

		// 3. If keys were already present on page load, quietly stop the startup poll
		L.Poll.stop();

	} catch {
		// Fallback-Handling if the API check fails (ESLint compliant error block)
		if (startupLockOverlay) {
			startupLockOverlay.style.display = 'none';
		}
		L.Poll.stop();
	}
};

/**
 * Setup default key ready refresh background pollers
 */
const setupPollDefaultKeysReady = function (appData) {
	let pollKeyReadyLocked = false;
	const pollKeyReady = async function () {
		if (pollKeyReadyLocked === true) {
			return;
		}
		pollKeyReadyLocked = true;
		try {
			await pollDefaultKeysReady(appData);
		} catch {
			// Silent fallback on failure
		}
		pollKeyReadyLocked = false;
		return;
	};

	if (!appData.keysReady) {
		L.Poll.add(L.bind(function () {
			pollKeyReady();
		}, this), 2);
	}
};


/**
 * --- MAIN VIEW ---
 */


/**
 * Create an empty array to hold all initial refreshes
 */
let initialRefreshQueue = [];

/**
 * Setup main refresh background pollers
 */
const setupMainRefresh = function (appData, statusTable) {
	let pollRefreshLocked = false;
	const pollRefresh = async function () {
		if (pollRefreshLocked === true) {
			return;
		}
		pollRefreshLocked = true;
		try {
			const openvpnStatus = appData.statusClass;
			if (openvpnStatus) {
				await openvpnStatus.refreshLiveDashboard(appData, statusTable, refreshStatusBoxCallback);
			}
			await refreshLog(appData);
			await refreshFirewall(appData);

			// initial refresh (once at startup)
			if (initialRefreshQueue.length > 0) {
				// We create a temporary array for items that are not ready yet
				var nextQueue = [];
				for (var i = 0; i < initialRefreshQueue.length; i++) {
					var item = initialRefreshQueue[i];
					if (item && typeof item.execute === 'function') {
						try {
							item.execute();
						} catch (queueError) {
							console.error("Error in initial refresh queue task:", queueError);
						}
					} else {
						// If the item is not ready yet (.execute is missing), keep it for the next poll tick!
						nextQueue.push(item);
					}
				}
				// Save only the unexecuted items back to the global queue
				initialRefreshQueue = nextQueue;
			}
		} catch {
			// Silent fallback on failure
		}
		pollRefreshLocked = false;
	}
	if (appData.ovpnUciSections.length > 0) {
		L.Poll.add(L.bind(function () {
			pollRefresh();
		}, this), 5);
	}
}

/**
 * Main entry point where the page starts loading
 */
return view.extend({

	// Create main data storage
	APP_DATA: Object.assign({}, APP_DATA_TEMPLATE, {
		ovpnUciSections: [],
		instances: []
	}),

	load: function () {
		L.uci.unload(CFG.CMD.openvpn);
		L.uci.unload(CFG.CMD.firewall);

		// 1. Trigger the background key initialization
		luci_app_openvpn_plus([CFG.LIBEXEC.initkeys]).catch(function (e) {
			console.log(CFG.LIBEXEC.luci_app_openvpn_plus + " " + CFG.LIBEXEC.initkeys + " -> ERROR: " + e.message);
		});
		// 2. Trigger the cleanup process
		luci_app_openvpn_plus([CFG.LIBEXEC.cleanup]).catch(function (e) {
			console.log(CFG.LIBEXEC.luci_app_openvpn_plus + " " + CFG.LIBEXEC.cleanup + " -> ERROR: " + e.message);
		});

		const appData = this.APP_DATA;

		// Load all required classes
		return Promise.all([
			L.require('view.vpn.openvpn-status'),
			L.require('view.vpn.openvpn-wizard'),
			L.require('view.vpn.openvpn-keygen'),
			L.uci.load(CFG.CMD.openvpn),
			L.uci.load(CFG.CMD.firewall)

		]).then(async function (results) {
			try {
				appData.statusClass = results[0];
				appData.wizardClass = results[1];
				appData.keygenClass = results[2];

				await appData.statusClass.onLoad();
				ovpnPending.init(appData);

				// Gets the openvon sections from LuCI
				const ovpnSections = L.uci.sections(CFG.CMD.openvpn, CFG.CMD.openvpn) || [];
				// Sorts the array alphabetically based on the internal '.name' (instance1, instance2, ...)
				ovpnSections.sort(function (a, b) {
					return a['.name'].localeCompare(b['.name'], undefined, { numeric: true, sensitivity: 'base' });
				});

				// if no section return empty views
				if (ovpnSections.length === 0) {
					await loadSystemTelemetry(appData);
					return initEmptyUciView();
				}

				appData.ovpnUciSections = Array.isArray(ovpnSections) ? ovpnSections : [];

				// Await the telemetry and instance assets data loads linearly
				await loadSystemTelemetry(appData);

				// Await the loads of settings and running state for all profiles
				await loadInstanceData(appData);

			} catch (err) {
				console.error('Error loading main OpenVPN dashboard data:', err);
			}
		});
	},

	/**
	 * Renders the OpenVPN dashboard view
	 */
	render: function () {
		try {


			const appData = this.APP_DATA;
			const openvpnState = isAnyInstanceEnabled(appData.ovpnUciSections) ? OPENVPN.STATE.active : OPENVPN.STATE.disabled;
			const openvpnStatus = appData.statusClass;
			const logLines = parseLogLines(appData);
			startupLockOverlay = renderDefaultKeysOverlay(appData.keysReady);

			const masterServerBtn = E('button', { 'class': 'btn cbi-button cbi-button-positive important' }, TXT.BTN.add_server);
			const masterClientBtn = E('button', { 'class': 'btn cbi-button cbi-button-action important' }, TXT.BTN.add_client);

			let instancesNode;
			let statusTable = null;

			if (appData.ovpnUciSections.length === 0) {
				instancesNode = E('div', { 'class': 'cbi-map' }, [
					E('div', { 'class': 'cbi-section' }, [
						E('h3', { 'style': 'font-weight:bold;' }, TXT.INFO.status),
						E('div', { 'class': 'cbi-section-node' }, [
							E('div', { 'class': 'alert-message info', 'style': 'margin:5px 0;' }, TXT.MSG.no_vpn_configured)
						])
					])
				]);
			} else {
				const instanceSections = [];
				appData.ovpnUciSections.forEach(function (s, idx) {
					// Render individual instance layout blocks using global memory arrays
					instanceSections.push(renderInstanceBox(s, idx, appData));
				});

				statusTable = E('div', { 'id': 'openvpn_live_table_wrapper' }, [
					openvpnStatus ? openvpnStatus.getStatusTable(appData.instances, parseFloat(appData.uptime) || 0, false, false) : ''
				]);

				instancesNode = E('div', {}, [
					E('div', { 'class': 'cbi-map' }, [
						E('div', { 'class': 'cbi-section' }, [
							E('h3', { 'style': 'font-weight:bold;' }, TXT.INFO.status),
							E('div', { 'class': 'cbi-section-node' }, [statusTable])
						])
					]),
					E('div', { 'class': 'cbi-section' }, instanceSections)
				]);
			}

			statusControlBox = E('div', {}, [
				renderStatusControlBox(openvpnState, masterServerBtn, masterClientBtn, appData)
			]);

			const renderOpenVPNView = E('div', { 'class': 'cbi-map', 'style': 'position:relative; min-height:300px;' }, [
				startupLockOverlay,

				statusControlBox,

				instancesNode,

				E('hr', { 'style': 'margin:10px 0; border:0;;' }),
				renderInstanceCreationBox(appData),

				E('hr', { 'style': 'margin:25px 0 35px 0; border:0;' }),
				renderFirewallInfoBox(appData),

				E('hr', { 'style': 'margin:15px 0; border:0;' }),
				renderLogBox(logLines, appData),
			]);

			window.requestAnimationFrame(function () {
				setupPollDefaultKeysReady(appData);
				setupMainRefresh(appData, statusTable);
			});

			return renderOpenVPNView;

		} catch (err) {
			console.error('Error rendering main OpenVPN dashboard: ', err);
		}
	}
});

/**
 * DEBUG: OpenWRT / LuCI developer shell debug commands
 *
 * # Show active live openvpn processes
 * ps | grep openvpn
 *
 * # Show active openvpn configuration
 * uci show openvpn
 *
 * # Force OpenVPN reload:
 * /etc/init.d/openvpn restart
 *
 * # Force fast LuCI interface layout cache refresh:
 * rm -rf /tmp/luci-* && /etc/init.d/rpcd restart
 *
 * # Simple process monitor for OpenVPN
 * while true; do printf "\033[H\033[J"; echo "=== OPENVPN LIVE MONITOR (Exit with CTRL+C) ==="; echo ""; ps -ww | grep openvpn | grep -v grep | awk '{ gsub(/.{120}/, "&\n "); print }'; sleep 1; done
 *
 */

