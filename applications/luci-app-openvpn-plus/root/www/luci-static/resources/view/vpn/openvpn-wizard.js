/*
 * Copyright (C) 2008-2026 The OpenWrt Project
 * Copyright (C) 2026 Manfred Jaider <info@masmbit.com>
 *
 * This is free software, licensed under the Apache License, Version 2.0.
 * See /LICENSE for more information.
 *
 * luci-app-openvpn-plus : configuration wizard for quick server and client deployment
 * /www/luci-static/resources/view/vpn/openvpn-wizard.js
 *
 * 1. --- TEXT & DEFINITIONS --- ....Global translations and system definitions
 * 2. --- HELPER --- ............... Router connections and file setup
 * 3. --- IMPORT / EXPORT --- ...... Import Client Instance / Export Server instance
 * 4. --- SETUP WIZARD --- ......... OpenVPN connection wizard modal
 */

/* global E, FileReader */
'use strict';

/*
 * --- TEXT & DEFINITIONS ---
 */
const TXT = {
	INFO: {
		action: _('Action'),
		connection_type: _('Connection Type'),
		creating_vpn: _('Creating VPN...'),
		custom_update_url: _('Custom Update URL'),
		ddns_provider: _('DDNS Provider'),
		domain_name: _('Domain Name'),
		destination: _('Destination'),
		external_port: _('External Port'),
		gateway: _('Gateway'),
		help: _('Help'),
		import_profile: _('Import Profile'),
		importing_profile: _('Importing profile...'),
		imported_clients: _('Imported Client'),
		imported_failed: _('Import Failed:'),
		inside_port: _('Inside Port'),
		internal_port: _('Internal Port'),
		internet_traffic: _('Internet Traffic'),
		lan_ip: _('LAN IP'),
		key_update_active: _('Key Update Active'),
		netmask: _('Netmask'),
		remote_lan_subnet: _('Remote LAN Subnet'),
		remote_name: _('Remote Name'),
		CLOSED: _('CLOSED'),
		BLOCKED: _('BLOCKED'),
		OPEN: _('OPEN'),
		OK: _('OK'),
		MISSING: _('MISSING'),
		WORKING: _('WORKING'),
		mask: _('Mask'),
		openvpn_profile_valid: _('OpenVPN Profile Valid:'),
		outside_port: _('Outside Port'),
		port_forwarding: _('Port Forwarding'),
		protocol: _('Protocol'),
		placeholder_eg: _('e.g.'),
		public_ip_or_domain: _('Public IP Address or Domain'),
		public_static_ip: _('Public Static IP'),
		remote_office_name: _('Remote Office Name'),
		resolving_target: _('Resolving Target...'),
		reveal_hide_password: _('Reveal/hide password'),
		select_vpn_type: _('Select VPN Type'),
		setup: _('Setup'),
		setup_wizard: _('OpenVPN Setup Wizard'),
		secure_tunnel: _('Secure Full Tunnel (Route all traffic over VPN)'),
		server_address: _('Server Address'),
		split_tunnel: _('Split Tunnel (Access home LAN only, faster web browsing)'),
		static_route: _('Static Route'),
		status: _('Status'),
		token_password: _('Token / Password'),
		username: _('Username'),
		vpn_name: _('VPN Name')
	},
	BTN: {
		add_office: _('Add Office'),
		back: _('Back'),
		cancel: _('Cancel'),
		check_address: _('Check Address Status'),
		create_vpn: _('Create VPN'),
		choose_file: _('Choose File...'),
		delete: _('Delete'),
		next: _('Next')
	},
	MSG: {
		add_your_other_office: _('Add your other offices below. Please enter the internal LAN network IP (e.g., 192.168.2.0) of each office, NOT their public WAN IP addresses. The server will connect all local networks automatically.'),
		another_router_detected: _('Another Router detected!'),
		this_router_not_main_internet_router: _('This OpenVPN Router is not the Main Internet Router.'),
		choose_how_send_through_vpn: _('Choose how your internet traffic is sent through the VPN. You can use any free OpenVPN app on your phone or laptop to import this profile.'),
		client_for_branch_office: _('Client for Branch Office (Branch)'),
		create_vpn_few_clicks: _('Create a secure VPN connection in just a few clicks.'),
		network_verification_failed: _('Network verification failed / Timeout'),
		checking_connection_background: _('Checking connection status in the background...'),
		delete_this_profile: _('Delete this office'),
		finding_your_public_ip: _('Finding your public IP address...'),
		for_phones_and_laptops: _('For Phones & Laptops (OpenVPN Connect App)'),
		internet_provides_static_ip: _('If your internet provides a static IP address.'),
		ip_static_bypassed_by_admin: _('Static IP check bypassed by administrator.'),
		ip_static_now_checked_by_admin: _('Static IP now checked by administrator.'),
		ip_validation_bypassed_after_net_failure: _('Validation bypassed after network failure.'),
		ip_validation_bypassed_by_admin: _('Validation bypassed by administrator.'),
		ip_valid_and_resolvable: _('Success: The IP address is valid and fully resolvable!'),
		is_already: _('is already'),
		is_currently: _('is currently'),
		keep_ip_setup: _('Keep IP Setup anyway'),
		keys_updated_successfully: _('Keys updated successfully!'),
		no_offices_added_yet: _('No offices added yet. Use the fields below to add the first office.'),
		no_file_choosen: _('No file chosen'),
		only_vpn_client_keys: _('This file contains only VPN client keys.'),
		open_port_success: _('Port Open Success'),
		placeholder_mydomain_publicip: _('e.g. mydomain.com or your public IP'),
		placeholder_myhomevpn: _('e.g. Mobile-Server, Main-Office'),
		please_add_static_routing: _('Please add static routing inside your Main Internet Router (IP: %s) using this OpenVPN Router (IP: %s) as Gateway.'),
		please_check_profe_file: _('Please check your profile file. A valid configuration file needs a remote target endpoint and key blocks.'),
		port_used_main_router: _('The port used on your main internet router.'),
		port_used_this_router: _('The port used on this OpenWrt router.'),
		please_create_port_forwarding: _('Please create a port forwarding rule inside your Main Internet Router (IP: %s) using this OpenVPN Router (IP: %s) as receiver.'),
		public_ip_or_domainname: _('The public IP address or your own external domain name.'),
		ready_for_connection: _('Ready for openvpn connections.'),
		routing_vpn_main_internet: _('The VPN routing via Main Internet Router (IP: %s) to remote subnet(s) (Net: %s)'),
		static_routing_missing: _('Static Routing missing!'),
		static_routing_success: _('Static Routing Success'),
		select_ovpn_profile: _('Select the (.ovpn) profile or (.crt) multi-key bundle. Settings will be configured or updated automatically.'),
		server_for_main_office: _('Server for Main Office (Headquarters)'),
		skip_check_unlock_create: _('Skip Check & Unlock Create Button'),
		switch_to_ddns: _('Switch to Dynamic DNS (DDNS)'),
		the_port_forward: _('The port forward'),
		tcp_for_traveling: _('TCP (Good for traveling - works behind firewalls)'),
		udp_performance: _('UDP (High Performance - maximum throughput)'),
		use_ddns_service: _('Use Dynamic DNS (DDNS) Service'),
		use_public_ip: _('Use Public IP Address / Domain')
	},
	DDNS: {
		duckdns_description: _('Number 1 for Open-Source and Home-Assistant setups.'),
		duckdns_link: 'https://duckdns.org',
		duckdns_placeholder: _('e.g. myname.duckdns.org'),
		duckdns_provider: _('DuckDNS (duckdns.org)'),
		duckdns_token: _('API Token'),
		ipv64_description: _('Modern free provider with perfect IPv6 and Dual-Stack support.'),
		ipv64_link: 'https://ipv64.net',
		ipv64_placeholder: _('e.g. myname.ipv64.net'),
		ipv64_provider: _('IPv64 (ipv64.net)'),
		ipv64_token: _('Domain Update URL / Key'),
		dynv6_description: _('Classic free provider with exceptional IPv6 and dual-stack support.'),
		dynv6_link: 'https://dynv6.com',
		dynv6_placeholder: _('e.g. myname.dynv6.net'),
		dynv6_provider: _('dynv6 (dynv6.com)'),
		dynv6_token: _('HTTP Token String'),
		dynu_description: _('Reliable free provider. Never expires, perfect for IPv6 and Dual-Stack.'),
		dynu_link: 'https://www.dynu.com',
		dynu_placeholder: _('e.g. myname.dynu.net'),
		dynu_provider: _('Dynu Systems (dynu.com)'),
		dynu_token: _('Password as plain text (Auto-SHA256)'),
		dynu_username: _('Username (Optional)'),
		noip_description: _('Very popular provider. WARNING: Free accounts require manual activation/renewal every 30 days via email.'),
		noip_link: 'https://www.noip.com',
		noip_placeholder: _('e.g. myname.ddns.net'),
		noip_provider: _('No-IP (noip.com)'),
		noip_token: _('DDNS Key'),
		noip_username: _('DDNS Username'),
		freemyip_description: _('Super fast setup without registration. WARNING: Blocked in some networks because it is completely anonymous.'),
		freemyip_link: 'https://freemyip.com',
		freemyip_placeholder: _('e.g. myname.freemyip.com'),
		freemyip_provider: _('FreeMYIP (freemyip.com)'),
		freemyip_token: _('Domain Update URL / token'),
		custom_description: _('Enter your own manual HTTP update URL structure.'),
		custom_placeholder: _('e.g. myname-custom-provider.com'),
		custom_provider: _('Custom / Manual Update URL'),
		custom_token: _('Token / Password'),
		custom_url_placeholder: _('e.g. https://custom-provider.com?domain=...&key=...')
	},
	WARNING: {
		ip_cannot_be_resolved: _('Warning: The IP address cannot be resolved. Your router might be offline.'),
		no_static_ip_selected: _('Warning: You did not select «Public Static IP». If your public IP address changes, your VPN tunnel will crash.'),
		openvpn_key_detected: _('OpenVPN Keys Detected:'),
		unsaved_text_input: _('Warning: You have un-saved text in the input fields. Please click the blue «Add Office» button to save it, or clear the fields to continue.'),
		upload_wrong_keys: _('Warning: If you upload wrong keys, your connection will stop!')
	},
	ERROR: {
		ERROR: 'ERROR',
		add_at_least_one_office: _('Error: Please add at least one office to the list before you continue.'),
		create_openvpn_server: _('Failed to create new OpenVPN server:'),
		dns_ip_check_failed: _('Network Error: DNS/IP query failed.'),
		ip_used_on_other_office: _('Error: This IP address is already used by another office. Every office needs a different IP address!'),
		net_status_check: _('Error: Network status check failed. Please try again.'),
		office_name_already_exist: _('Error: An office with this name is already in the list.'),
		use_local_ipnetwork: _('Error: You cannot use this IP network! It is the local network of this router and will block all traffic.'),
		vpn_name_validation: _('Validation Error: The VPN Name must contain only letters, numbers, hyphens or underscores.'),
		file_corrupted: _('Error: File is corrupted or missing vital fields.'),
	}
};

const ICON = Object.freeze({
	ARROW: '➔ ',
	BRANCH: '🏪 ',
	CHECK: '✓ ',
	ERROR: '❌ ',
	GLOBE: '🌐 ',
	IMPORT: '📂 ',
	INFO: 'ℹ️ ',
	LINK: '🔗 ',
	LOADING: '⏳ ',
	OFFICE: '🏢 ',
	PHONE: '📱 ',
	PLUS: '➕ ',
	REMOVE: '🗑 ',
	ROCKET: '🚀 ',
	SHIELD: '🛡️ ',
	SPLIT: '🔀 ',
	SUCCESS: '✅ ',
	TAG: '🏷️ ',
	WARNING: '⚠️ ',
	WIZARD: '🪄 '
});

const OPENVPN = Object.freeze({
	ROLE: Object.freeze({
		SERVER: 'server',
		CLIENT: 'client'
	}),
	STRATEGY: Object.freeze({
		STANDARD: 'standard',
		REDIRECT: 'redirect',
		SITETOSITE: 'sitetosite'
	}),
	PROTO: Object.freeze({
		TCP: 'tcp',
		UDP: 'udp'
	}),
	PORT: Object.freeze({
		s1194: '1194',
		s443: '443',
		s444: '444',
		n1194: 1194
	}),
	IPv4: Object.freeze({
		ZERO: '0.0.0.0',
		MASK24: '255.255.255.0'
	}),
	CONN_TYPE: Object.freeze({
		IP: 'ip',
		DDNS: 'ddns'
	}),
	SCENARIO: Object.freeze({
		CONNECT_SERVER: 'connect_server',
		SITE_TO_SITE_SERVER: 'sitetosite_server',
		SITE_TO_SITE_CLIENT: 'sitetosite_client'
	})
});

/**
 * Data structure used on wizard creation.
 * Contains core dashboard runtime variables and asynchronous logic execution callbacks.
 */
const WIZARD_DATA_TEMPLATE = Object.freeze({
	appData: null,								// Holds the main application interface context data
	addNewInstanceCallback: null,				// Function to create or update an OpenVPN instance configuration
	networkCallbacks: null,						// Network callbacks container
	uciSaveApplyRestartCallback: null,			// Function to trigger the official green save-and-apply banner in LuCI
	importOvpnClientProfileCallback: null,		// Function to parse text, key bundles, and routing layouts from uploaded files
	instanceNumber: 1,							// Stores the current or next available numeric instance identification index
	forcedScenario: null,						// Bypasses the initial role selection step if the scenario context is locked
});

/**
 * Data structure returned by the wizard.
 * Holds the validated, sanitized user inputs ready for the UCI configuration builder staging.
 */
const WIZARD_PARAMS_TEMPLATE = Object.freeze({
	role: OPENVPN.ROLE.SERVER,					// Target configuration profile role mapping (server or client)
	port: OPENVPN.PORT.n1194,					// Internal numeric system port assignment for the local process listener
	portExtern: OPENVPN.PORT.n1194,				// External port offset mapping used for firewall rule deployments
	proto: OPENVPN.PROTO.UDP,					// Transport layer connection protocol string selection (udp or tcp)
	displayName: '',							// Localized custom alias name assigned to distinguish the specific tunnel
	strategy: OPENVPN.STRATEGY.STANDARD,		// Network traffic management profile (standard, redirect, or sitetosite)
	remoteServer: '',							// Client role parameter: Target remote server public IP or domain string
	remoteServerLan: '',						// Client role parameter: Target remote server LAN Subnet (e.g. 192.168.10.0/24)
	clients: null,								// Multi-client server list container mapping routing subnets for branch offices
	isApMode: false,							// Gateway infrastructure toggle specifying if the local device runs in AP mode
	connectionType: OPENVPN.CONN_TYPE.IP,		// Public endpoint resolution strategy definition toggling between ip and ddns
	ddnsOrPublicIp: '',							// Cleaned WAN endpoint value storing the public lookup target domain or static IP
	isStaticIp: false,							// Semiautomatic safety override bypassing the active IP migration checks
	ddnsProvider: '',							// Selected dynamic DNS provider configuration key profile token identification
	ddnsUrl: '',								// Generated secure HTTP GET request string dispatched for provider synchronization
	importedRawOvpn: ''							// Temporary payload staging buffer holding raw client file profile contents
});


/*
 * --- HELPER ---
 */


/**
 * Generates the final update URL for the selected DDNS provider.
 */
const buildDdnsUpdateUrl = async function (provider, domain, token, ddnsUser, wizardData, maskedStars) {
	// Security check: We always need a provider, a domain, and a token/password
	if (!provider || !domain) {
		return '';
	}
	let url = '';
	if (provider === 'custom') {
		url = ddnsUser;
	} else {
		if (!token || typeof token !== 'string') {
			return '';
		}
		// If the token is a full HTTPS URL, use it directly
		if (token.startsWith('https://')) {
			if (maskedStars) {
				url = maskedStars;
			} else {
				url = token;
			}
		} else {
			if (maskedStars) {
				token = maskedStars;
			}
			// Generate the final update URL structure using the clean domain
			if (provider === 'duckdns') {
				url = 'https://duckdns.org/update?domains=' + domain + '&token=' + token;
			} else if (provider === 'ipv64') {
				url = 'https://ipv64.net/nic/update?key=' + token + '&domain=' + domain;
			} else if (provider === 'freemyip') {
				url = 'https://freemyip.com/update?token=' + token + '&domain=' + domain;
			} else if (provider === 'dynv6') {
				url = 'https://dynv6.com/api/update?zone=' + domain + '&token=' + token + '&ipv4=auto&ipv6=auto';
			} else if (provider === 'dynu') {
				if (ddnsUser) {
					url = 'https://api.dynu.com/nic/update?hostname=' + domain + '&username=' + ddnsUser + '&password=' + String(await wizardData.networkCallbacks.sha256sum(token));
				} else {
					url = 'https://api.dynu.com/nic/update?hostname=' + domain + '&password=' + String(await wizardData.networkCallbacks.sha256sum(token));
				}
			} else if (provider === 'noip') {
				if (!ddnsUser) {
					return '';
				}
				url = 'https://' + ddnsUser + ':' + token + '@dynupdate.no-ip.com/nic/update?hostname=' + domain;
			}
		}
	}
	return url;
}

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
 * Cleans a name string to remove bad characters and make it safe for files or text.
 */
const getValidCommonName = function (name) {
	if (!name) {
		return null;
	}

	// Define X.509 RFC length bounds
	const MIN_LENGTH = 2;
	const MAX_LENGTH = 64;
	const trimmedName = sanitizeInputLine(name);

	// Enforce a unified safe string rule by converting all spaces and symbols to underscores
	const cleanName = trimmedName
		.replace(/[^a-zA-Z0-9_-]/g, '_')
		.replace(/_+/g, '_')
		.replace(/-+/g, '-')
		.trim()
		.replace(/^[_-]+|[_-]+$/g, '');

	// Return null if the sanitized string violates X.509 length constraints
	if (cleanName.length < MIN_LENGTH || cleanName.length > MAX_LENGTH) {
		return null;
	}

	return cleanName;
};

/**
 * Validate and clean any given IPv4 or IPv6 address string
 */
const checkIPAddress = function (rawIp) {
	if (!rawIp) {
		return null;
	}

	// Delete all spaces, tabs and hidden lines from the text (tr -d ' \t\r\n')
	const ip = rawIp.replace(/[\s\t\r\n]/g, '');
	if (ip === '') {
		return null;
	}

	const ipv4Regex = /^([0-9]{1,3}\.){3}[0-9]{1,3}$/;

	// FIXED: Standard compliant IPv6 pattern that correctly handles "::" and blocks ":::"
	const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){1,7}:$|^(?:[0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}$|^(?:[0-9a-fA-F]{1,4}:){1,5}(?::[0-9a-fA-F]{1,4}){1,2}$|^(?:[0-9a-fA-F]{1,4}:){1,4}(?::[0-9a-fA-F]{1,4}){1,3}$|^(?:[0-9a-fA-F]{1,4}:){1,3}(?::[0-9a-fA-F]{1,4}){1,4}$|^(?:[0-9a-fA-F]{1,4}:){1,2}(?::[0-9a-fA-F]{1,4}){1,5}$|^[0-9a-fA-F]{1,4}:(?::[0-9a-fA-F]{1,4}){1,6}$|^:(?::[0-9a-fA-F]{1,4}){1,7}$|^::$/;

	// Case 1: Check if the text is a valid IPv4 address (numbers 0 to 255)
	if (ipv4Regex.test(ip)) {
		const segments = ip.split('.');
		const octet1 = parseInt(segments[0], 10);
		const octet2 = parseInt(segments[1], 10);
		const octet3 = parseInt(segments[2], 10);
		const octet4 = parseInt(segments[3], 10);

		// Match the awk rule: $1<=255 && $2<=255 && $3<=255 && $4<=255
		if (octet1 <= 255 && octet2 <= 255 && octet3 <= 255 && octet4 <= 255) {
			return { ip: ip, isV6: false };
		}
	}

	// Case 2: Check if the text matches the verified IPv6 regex
	if (ipv6Regex.test(ip)) {
		if (ip.indexOf(':') !== -1) {
			// Change all hex letters to lowercase for safe matching later (tr 'A-Z' 'a-z')
			return { ip: ip.toLowerCase(), isV6: true };
		}
	}

	return null;
};

/**
 * Generates an isolated, self-validating Site-to-Site network inputs row layout block
 */
const renderSubnetInputs = function () {
	// Create the 3 input fields with simple, easy text placeholders
	const cnInput = E('input', { 'type': 'text', 'class': 'cbi-input-text', 'placeholder': TXT.INFO.remote_office_name, 'style': 'width:32%; font-family:monospace; margin-right:1%;' });
	const subnetInput = E('input', { 'type': 'text', 'class': 'cbi-input-text', 'placeholder': TXT.INFO.lan_ip + ' (192.168.2.0)', 'style': 'width:32%; font-family:monospace; margin-right:1%;' });
	const maskInput = E('input', { 'type': 'text', 'class': 'cbi-input-text', 'placeholder': TXT.INFO.netmask + ' (255.255.255.0)', 'style': 'width:32%; font-family:monospace; margin-right:1%;' });

	// Put the 3 input fields together in one horizontal line
	const container = E('div', { 'style': 'margin-top:4px;' }, [cnInput, subnetInput, maskInput]);

	// Remove the red error borders when the user starts typing again
	const clearErrorFlags = function () {
		cnInput.classList.remove('cbi-input-invalid');
		subnetInput.classList.remove('cbi-input-invalid');
		maskInput.classList.remove('cbi-input-invalid');
	};

	cnInput.addEventListener('input', clearErrorFlags);
	subnetInput.addEventListener('input', clearErrorFlags);
	maskInput.addEventListener('input', clearErrorFlags);

	return {
		// Return the HTML container node to the main wizard layout
		node: container,

		// Return the links to the fields so we can clear or focus them
		fields: { cn: cnInput, sub: subnetInput, mask: maskInput },

		clearErrors: function () {
			clearErrorFlags();
		},

		// This function checks if the typed text is correct
		validateAndFetchData: function () {
			clearErrorFlags();

			let rawCn = sanitizeInputLine(cnInput.value);
			let rawSub = sanitizeInputLine(subnetInput.value);
			let rawMask = sanitizeInputLine(maskInput.value);

			let hasValidationError = false;
			let cleanCn = '';
			let cleanSub = '';
			let cleanMask = '';

			// 1. Check if the Office Name is valid
			cleanCn = getValidCommonName(rawCn);
			if (!rawCn || !cleanCn) {
				cnInput.classList.add('cbi-input-invalid');
				hasValidationError = true;
			}

			// --- SMART CIDR INLINE PARSER LAYER ---
			// Check if the user typed a slash '/' directly into the IP address field
			if (rawSub.indexOf('/') !== -1) {
				const urlParts = rawSub.split('/');
				rawSub = urlParts[0].trim(); // Save the raw IP block

				// Only overwrite rawMask if the mask field was left completely empty
				if (!rawMask) {
					rawMask = urlParts[1].trim();
				}
			}

			// 2. Validate IP Address using your verified template logic
			const ipResult = checkIPAddress(rawSub);
			if (!ipResult) {
				subnetInput.classList.add('cbi-input-invalid');
				hasValidationError = true;
			}

			// 3. Validate Netmask based on the detected protocol version
			if (!rawMask) {
				maskInput.classList.add('cbi-input-invalid');
				hasValidationError = true;
			} else if (ipResult && ipResult.isV6) {
				// IPv6 Prefix Validation (e.g., 64)
				const prefixTmp = parseInt(rawMask, 10);
				if (isNaN(prefixTmp) || prefixTmp < 0 || prefixTmp > 128) {
					maskInput.classList.add('cbi-input-invalid');
					hasValidationError = true;
				} else {
					cleanMask = prefixTmp.toString();
					cleanSub = ipResult.ip;
				}
			} else if (ipResult && !ipResult.isV6) {
				// Convert pure numeric CIDR strings like "24" or "25" into real netmasks 255.255.255.0
				let maskTmp = rawMask;
				if (!isNaN(maskTmp) && parseInt(maskTmp, 10) >= 0 && parseInt(maskTmp, 10) <= 32) {
					const numericPrefix = parseInt(maskTmp, 10);
					const calcOctets = [];
					for (let o = 0; o < 4; o++) {
						if (numericPrefix >= (o + 1) * 8) {
							calcOctets.push(255);
						} else if (numericPrefix <= o * 8) {
							calcOctets.push(0);
						} else {
							const remainingBits = numericPrefix % 8;
							calcOctets.push(256 - Math.pow(2, 8 - remainingBits));
						}
					}
					maskTmp = calcOctets.join('.');
				}

				if (!maskTmp.match(/^([0-9]{1,3}\.){3}[0-9]{1,3}$/)) {
					maskInput.classList.add('cbi-input-invalid');
					hasValidationError = true;
				} else if (!hasValidationError) {
					// Mathematical network boundary fix (Bitwise AND) for IPv4
					const ipSegments = ipResult.ip.split('.');
					const maskSegments = maskTmp.split('.');
					const netSegments = [];

					for (let i = 0; i < 4; i++) {
						const ipOctet = parseInt(ipSegments[i], 10);
						const maskOctet = parseInt(maskSegments[i], 10);

						if (maskOctet > 255) {
							hasValidationError = true;
							break;
						}
						netSegments.push(ipOctet & maskOctet);
					}

					if (hasValidationError) {
						maskInput.classList.add('cbi-input-invalid');
					} else {
						cleanSub = netSegments.join('.');
						cleanMask = maskTmp;
					}
				}
			}

			if (hasValidationError) {
				return null;
			}

			return { commonName: cleanCn, subnet: cleanSub, mask: cleanMask, isV6: ipResult.isV6 };
		}
	};
};

/**
 * Creates Port Forwarding warning block with dynamic port state checking and local caching.
 */
const renderPortForwardingAlert = function (networkCallbacks) {

	// Token to stop old background checks if inputs change quickly
	let currentExecutionToken = 0;

	// Create the main alert box element
	const portNode = E('div', {
		'class': 'alert-message',
		'style': 'margin-bottom:10px; padding:10px; font-size:12px; line-height:1.5; display:none !important;'
	});
	const srouteNode = E('div', {
		'class': 'alert-message',
		'style': 'margin-bottom:10px; padding:10px; font-size:12px; line-height:1.5; display:none !important;'
	});
	const alertNode = E('div', {
		'style': 'margin-bottom:10px; padding:0; border:0; display:none !important;'
	}, [
		portNode, srouteNode
	]);

	const styleAlertInfo = 'margin-bottom:20px; padding:10px; font-size:12px; line-height:1.5; background:color-mix(in srgb, var(--primary-color-high, #1976d2) 6%, transparent); border:1px solid var(--border-color-medium, #cbd5e1); color:var(--text-color-high, #3f3f46); border-radius:4px;';
	const styleStatusMsg = 'display:block; height:30px; box-sizing:border-box; padding-top:4px;';
	const styleLabelSuccess = 'background: var(--success-color-high, #00ac59) !important; color: white !important; font-weight: bold !important; padding: 2px 6px !important; border-radius: 3px !important; margin-left: 7px !important; text-transform: uppercase !important;';
	const styleLabelWarning = 'background: var(--error-color-high, #f62b12) !important; color: white !important; font-weight: bold !important; padding: 2px 6px !important; border-radius: 3px !important; margin-left: 7px !important; text-transform: uppercase !important;';
	const styleLabelFixHint = 'font-weight:bold !important; font-family: var(--font-sans-serif, sans-serif);';
	const styleHintOk = 'margin-top:10px; padding: 5px; background:color-mix(in srgb, var(--primary-color-high, #1976d2) 10%, transparent); border-left:4px solid var(--primary-color-high, #1976d2); font-family:var(--font-monospace, monospace); line-height: 1.6; font-weight:bold; font-size: 13px; text-align: center; border-radius: 4px;';
	const styleHintWarning = 'margin-top:10px; padding: 5px; background:color-mix(in srgb, var(--warn-color-high, #efbd0b) 18%, transparent); border-left:4px solid var(--warn-color-high, #efbd0b); font-family:var(--font-monospace, monospace); line-height: 1.6; font-weight:bold; font-size: 13px; text-align: center; border-radius: 4px;';
	const loadingSpinner = '<span class="spinning port-forward-spinner" style="display:inline-block; position:relative; width:10px; height:10px; margin-right:0px; padding-left: 22px !important"><style>.port-forward-spinner::before { width:15px !important; height:15px !important; top:calc(50% - 7px) !important; left:0px !important}</style></span>';

	const ALERT_DATA_TEMPLATE = Object.freeze({
		doubleNat: false,
		publicIp: '',
		wanRouterIp: '',
		vpnRouterIp: '',
		externalPort: '',
		internalPort: '',
		protoValue: '',
		roleValue: '',
		remoteSubnets: '',
		portCheckTime: '',
		isPortOpen: false,
		isPortValid: false,
		isPortCheckLocked: false,
		portStatusText: '',
		portStatusIcon: '',
		sRouteMissing: false,
		sRouteValid: false,
		sRouteCheckLocked: false,
		sRouteStatusText: '',
		sRouteStatusIcon: ''
	});
	const alertData = Object.assign({}, ALERT_DATA_TEMPLATE, {});
	const last_alertData = Object.assign({}, ALERT_DATA_TEMPLATE, {});

	// Server Only: Port forwarding check
	const runPortForwardingSubCheck = async function (type) {

		// Create the static layout text layers
		let forwardLine;
		if (alertData.wanRouterIp && alertData.wanRouterIp !== OPENVPN.IPv4.ZERO) {
			forwardLine = alertData.wanRouterIp + ':' + alertData.externalPort + ' ' + ICON.ARROW + ' ' + alertData.vpnRouterIp + ':' + alertData.internalPort;
		} else {
			forwardLine = TXT.INFO.outside_port + ': ' + alertData.externalPort + ' ' + ICON.ARROW + ' ' + TXT.INFO.inside_port + ': ' + alertData.internalPort;
		}

		const portInfo = TXT.MSG.the_port_forward + ' (Internet) <strong>' + alertData.externalPort + ' ' + ICON.ARROW + ' ' + alertData.internalPort + '</strong> (VPN) ';

		if (type == 'init') {

			// a) Show init port alert box immediately as neutral INFO box without networkCallbacks.checkPort()

			let forwardHint = '<div style="' + styleHintOk + '">' + TXT.INFO.port_forwarding + ': ' + forwardLine + ' (' + alertData.protoValue + ')';

			alertData.portStatusIcon = ICON.INFO;
			alertData.portStatusText = TXT.MSG.another_router_detected;

			portNode.className = 'alert-message';
			portNode.style.cssText = styleAlertInfo;
			forwardHint = forwardHint + '</div>';
			portNode.innerHTML = '<strong>' + alertData.portStatusIcon + alertData.portStatusText + '</strong><br/>' +
				TXT.MSG.this_router_not_main_internet_router + ' ' + portInfo + '...<br/>' +
				'<div style="' + styleStatusMsg + '">' + loadingSpinner + '<span>' + TXT.MSG.checking_connection_background + '</span>' + '</div>' + forwardHint;

			return { valid: true, portOpen: false }

		} else if (type == 'error') {

			// b) Show error port alert box

			let forwardHint = '<div style="' + styleHintWarning + '">' + TXT.INFO.port_forwarding + ': ' + forwardLine + ' (' + alertData.protoValue + ')';

			portNode.className = 'alert-message';
			portNode.style.cssText = styleAlertInfo;

			alertData.portStatusIcon = ICON.WARNING;
			alertData.portStatusText = TXT.MSG.another_router_detected;

			forwardHint = forwardHint + '<span class="label" style="' + styleLabelWarning + '">' + TXT.ERROR.ERROR + '</span></div>';

			portNode.innerHTML = '<strong>' + alertData.portStatusIcon + alertData.portStatusText + '</strong><br/>' +
				TXT.MSG.this_router_not_main_internet_router + ' ' + portInfo + '<br/>' + '<div style="' + styleStatusMsg + '">' +
				'<span>' + ICON.ERROR + TXT.MSG.network_verification_failed + '</span>' + '</div>' + forwardHint;


			return { valid: true, portOpen: false }

		} else {

			// c) Show normal port alert box with full info

			const isPortOpen = await networkCallbacks.checkPort(alertData.publicIp, alertData.externalPort, alertData.internalPort, alertData.protoValue);
			let statusContent = '';

			if (isPortOpen === true) {

				let forwardHint = '<div style="' + styleHintOk + '">' + TXT.INFO.port_forwarding + ': ' + forwardLine + ' (' + alertData.protoValue + ')';

				alertData.portStatusIcon = ICON.CHECK;
				alertData.portStatusText = TXT.MSG.open_port_success;

				portNode.className = 'alert-message';
				portNode.style.cssText = styleAlertInfo;
				forwardHint = forwardHint + '<span class="label" style="' + styleLabelSuccess + styleLabelFixHint + '">' + TXT.INFO.OK + '</span></div>';
				statusContent = '<strong>' + TXT.INFO.status + ':</strong> ' + TXT.MSG.ready_for_connection;

				portNode.innerHTML = '<strong>' + alertData.portStatusIcon + alertData.portStatusText + '</strong><br/>' +
					TXT.MSG.this_router_not_main_internet_router + ' ' + portInfo + TXT.MSG.is_already +
					'<span class="label" style="' + styleLabelSuccess + '">' + TXT.INFO.OPEN + '</span><br/>' +
					'<div style="' + styleStatusMsg + '">' + statusContent + '</div>' + forwardHint;
			} else {

				let forwardHint = '<div style="' + styleHintWarning + '">' + TXT.INFO.port_forwarding + ': ' + forwardLine + ' (' + alertData.protoValue + ')';

				portNode.className = 'alert-message';
				portNode.style.cssText = styleAlertInfo;

				alertData.portStatusIcon = ICON.WARNING;
				alertData.portStatusText = TXT.MSG.another_router_detected;

				forwardHint = forwardHint + '<span class="label" style="' + styleLabelWarning + styleLabelFixHint + '">' + TXT.INFO.MISSING + '</span></div>';
				statusContent = '<strong>' + TXT.INFO.action + ':</strong> ' + TXT.MSG.please_create_port_forwarding.format('<strong>' + alertData.wanRouterIp + '</strong>', '<strong>' + alertData.vpnRouterIp + '</strong>');

				portNode.innerHTML = '<strong>' + alertData.portStatusIcon + alertData.portStatusText + '</strong><br/>' +
					TXT.MSG.this_router_not_main_internet_router + ' ' + portInfo + TXT.MSG.is_currently +
					'<span class="label" style="' + styleLabelWarning + '">' + TXT.INFO.CLOSED + '</span><br/>' +
					'<div style="' + styleStatusMsg + '">' + statusContent + '</div>' + forwardHint;
			}
			return { valid: true, portOpen: isPortOpen };
		}
	};

	// Server & Client: Static routing check
	const runStaticRoutingSubCheck = async function () {
		const remoteSubnets = alertData.remoteSubnets;
		if (!Array.isArray(remoteSubnets) || remoteSubnets.length === 0) {
			return { valid: false, sRoutingMissing: false };
		}

		const nostaticSubnetList = [];
		const staticSubnetList = [];
		let staticRoutingMissingDetected = false;

		let sheetHtml = '';

		for (let i = 0; i < remoteSubnets.length; i++) {
			if (!remoteSubnets[i]) continue;

			// Extract pure clean NET IP block safely from the cached array strings
			let pureNetIp = remoteSubnets[i] || '';
			let extractedPrefix = '24';
			if (pureNetIp.includes('/')) {
				const res = pureNetIp.split('/');
				pureNetIp = res[0].trim();
				extractedPrefix = res[1];
			}

			// Core Dual-Stack background script trigger pipeline
			try {
				if (pureNetIp.length > 0) {
					const isStaticRoute = await networkCallbacks.checkStaticRoute(alertData.wanRouterIp, pureNetIp);
					if (isStaticRoute === true) {
						if (!staticSubnetList.includes(pureNetIp)) {
							staticSubnetList.push(pureNetIp);
						}
					} else {
						staticRoutingMissingDetected = true;
						if (!nostaticSubnetList.includes(pureNetIp)) {
							nostaticSubnetList.push(pureNetIp);
						}
					}
					if (sheetHtml.length > 0) {
						sheetHtml += '<br />'
					}
					if (remoteSubnets[i].includes(':')) {

						// IPv6: Compact CIDR Notation (e.g. Destination: fd00:db8:10::/64)
						sheetHtml += ICON.LINK + TXT.INFO.static_route + ' ' + ICON.ARROW + ' IP: ' + remoteSubnets[i] + ', ' + TXT.INFO.gateway + ' IP: ' + alertData.vpnRouterIp;
					} else {

						// IPv4: Split Matrix Layout (e.g. Destination: 192.168.10.0, Mask: 255.255.255.0)
						let calculatedMask = OPENVPN.IPv4.MASK24;
						if (extractedPrefix !== '24') {
							const maskArray = [0, 0, 0, 0];
							const inlinePrefixNum = parseInt(extractedPrefix, 10) || 24;
							for (let bit4 = 0; bit4 < 32; bit4++) {
								if (bit4 < inlinePrefixNum) {
									maskArray[Math.floor(bit4 / 8)] |= (1 << (7 - (bit4 % 8)));
								}
							}
							calculatedMask = maskArray.join('.');
						}
						sheetHtml += ICON.LINK + TXT.INFO.static_route + ' ' + ICON.ARROW + ' ' + TXT.INFO.destination + ' IP: ' + pureNetIp + ', ' + TXT.INFO.mask + ': ' + calculatedMask + ', ' + TXT.INFO.gateway + ' IP: ' + alertData.vpnRouterIp;
					}
					if (isStaticRoute) {
						sheetHtml += '<span class="label" style="' + styleLabelSuccess + styleLabelFixHint + '">' + TXT.INFO.OK + '</span>';
					} else {
						sheetHtml += '<span class="label" style="' + styleLabelWarning + styleLabelFixHint + '">' + TXT.INFO.MISSING + '</span>';
					}
				}

			} catch (err) {
				console.error('Background static route scanner failed:', err);
			}
		}

		// no subnet found
		if (nostaticSubnetList.length === 0 && staticSubnetList.length === 0) {
			return { valid: false, sRoutingMissing: false };
		}

		if (staticRoutingMissingDetected === false) {

			const staticRouteHint = '<div style="' + styleHintOk + '">' + sheetHtml + '</div>';
			const staticCommaSeparatedNets = staticSubnetList.join(', ');
			const statusContent = '<strong>' + TXT.INFO.status + ':</strong> ' + TXT.MSG.ready_for_connection;

			alertData.sRouteStatusIcon = ICON.CHECK;
			alertData.sRouteStatusText = TXT.MSG.static_routing_success;

			srouteNode.className = 'alert-message';
			srouteNode.style.cssText = styleAlertInfo;

			srouteNode.innerHTML = '<strong>' + alertData.sRouteStatusIcon + alertData.sRouteStatusText + '</strong><br/>' +
				TXT.MSG.routing_vpn_main_internet.format('<strong>' + alertData.wanRouterIp + '</strong>', '<strong>' + staticCommaSeparatedNets + '</strong>') + ' ' + TXT.MSG.is_already +
				'<span class="label" style="' + styleLabelSuccess + '">' + TXT.INFO.WORKING + '</span><br/>' +
				'<div style="' + styleStatusMsg + '">' + statusContent + '</div>' + staticRouteHint;

		} else {

			const staticRouteHint = '<div style="' + styleHintWarning + '">' + sheetHtml + '</div>';
			const nostaticCommaSeparatedNets = nostaticSubnetList.join(', ');
			const actionContent = '<strong>' + TXT.INFO.action + ': </strong>' + TXT.MSG.please_add_static_routing.format('<strong>' + alertData.wanRouterIp + '</strong>', '<strong>' + alertData.vpnRouterIp + '</strong>');

			alertData.sRouteStatusIcon = ICON.WARNING;
			alertData.sRouteStatusText = TXT.MSG.static_routing_missing;

			srouteNode.className = 'alert-message';
			srouteNode.style.cssText = styleAlertInfo;

			srouteNode.innerHTML = '<strong>' + alertData.sRouteStatusIcon + alertData.sRouteStatusText + '</strong><br/>' +
				TXT.MSG.routing_vpn_main_internet.format('<strong>' + alertData.wanRouterIp + '</strong>', '<strong>' + nostaticCommaSeparatedNets + '</strong>') + ' ' + TXT.MSG.is_currently +
				'<span class="label" style="' + styleLabelWarning + '">' + TXT.INFO.BLOCKED + '</span><br/>' +
				'<div style="' + styleStatusMsg + '">' + actionContent + '</div>' + staticRouteHint;
		}

		return { valid: true, sRoutingMissing: staticRoutingMissingDetected };
	};

	// Background port open and static routing check
	const runBackgroundPortCheck = async function (executionToken, force) {
		const isServer = (alertData.roleValue === OPENVPN.ROLE.SERVER);
		try {
			alertData.publicIp = await networkCallbacks.queryPublicIp(force) || alertData.vpnRouterIp;
			let result = null;

			// Get isPortOpen
			if (alertData.isPortCheckLocked === false) {
				alertData.isPortCheckLocked = true;
				{
					alertData.isPortValid = false;
					alertData.isPortOpen = false;
					if (isServer === true) {
						result = await runPortForwardingSubCheck('normal');
						if (result) {
							alertData.isPortOpen = result.portOpen;
							alertData.isPortValid = result.valid;
						}
						portNode.style.setProperty('display', 'block', 'important');
					} else {
						portNode.style.setProperty('display', 'none', 'important');
					}
				}
				alertData.isPortCheckLocked = false;
			}

			// Stop execution loops safely if a newer input check is already active
			if (executionToken !== currentExecutionToken) {
				return;
			}

			// Get staticRoute
			if (alertData.sRouteCheckLocked === false) {
				alertData.sRouteCheckLocked = true;
				{
					alertData.sRouteValid = false;
					alertData.sRouteMissing = false;
					result = await runStaticRoutingSubCheck();
					if (result) {
						alertData.sRouteMissing = result.sRoutingMissing;
						alertData.sRouteValid = result.valid;
					}
					if (alertData.sRouteValid === true) {
						srouteNode.style.setProperty('display', 'block', 'important');
					} else {
						srouteNode.style.setProperty('display', 'none', 'important');
					}
				}
				alertData.sRouteCheckLocked = false;
			}

			// Stop execution loops safely if a newer input check is already active
			if (executionToken !== currentExecutionToken) {
				return;
			}

			// Update last_alertData for caching
			Object.assign(last_alertData, alertData, {
				portCheckTime: Date.now()
			});

			if (alertData.doubleNat === true) {
				alertNode.style.setProperty('display', 'block', 'important');
			} else {
				alertNode.style.setProperty('display', 'none', 'important');
			}
			return alertData;

		} catch (e) {
			console.error("Background multi-diagnostic check pipeline crashed:", e);
			if (isServer === true) {
				if (executionToken !== currentExecutionToken) return;
				await runPortForwardingSubCheck('error');
				portNode.style.setProperty('display', 'block', 'important');
				alertNode.style.setProperty('display', 'block', 'important');
			}
		}
	};

	return {

		// The HTML element to insert into the view layout
		node: alertNode,

		// Check if the alert is currently visible on the screen
		isAlertActive: function () {
			return (alertNode.style.display !== 'none');
		},

		// Check if we need to show the PortForwarding and Static Routing Alert
		check: async function (protoValue, roleValue, portValue, clientPortValue, remoteSubnets, appData, force, runBackgroundPortCheckExtern) {

			const isServer = (roleValue === OPENVPN.ROLE.SERVER);

			// STAGE 1: Fast check of the local network structure
			const networkState = await networkCallbacks.checkNetworkStructure(appData);

			// Stop instantly if topology operates in standard gateway routing
			if (!networkState || networkState.doubleNat !== true || networkState.apMode === true) {
				alertNode.style.setProperty('display', 'none', 'important');
				alertData.doubleNat = false;
				return true;
			} else {
				alertData.doubleNat = true;
			}

			alertData.protoValue = protoValue;
			alertData.roleValue = roleValue;
			alertData.portValue = portValue;
			alertData.remoteSubnets = remoteSubnets;
			alertData.vpnRouterIp = await networkCallbacks.getLanIp();

			// Safe parsing of port values if they are arrays (takes the first element)
			const rawIntPort = Array.isArray(portValue) ? portValue[0] : portValue;
			alertData.internalPort = String(rawIntPort || OPENVPN.PORT.s1194).trim();
			const rawExtPort = Array.isArray(clientPortValue) ? clientPortValue[0] : clientPortValue;
			alertData.externalPort = String(rawExtPort || alertData.internalPort).trim();
			alertData.wanRouterIp = networkState.gateway || OPENVPN.IPv4.ZERO;

			// Check if we can skip the intensive check and use cached results
			let skipPortcheck = false;
			if (force !== true) {
				let keysAreEqual = true;
				const templateKeys = Object.keys(ALERT_DATA_TEMPLATE);
				for (let i = 0; i < templateKeys.length; i++) {
					const key = templateKeys[i];
					// Skip the timestamp during the hard equality match loop
					if (key === 'portCheckTime') continue;
					if (last_alertData[key] !== alertData[key]) {
						keysAreEqual = false;
						// Exit instantly if even one single metric mismatches
						break;
					}
				}
				// If all configuration metrics match AND the cache is younger than 60 seconds, skip the check!
				if (keysAreEqual === true && Math.abs(Date.now() - last_alertData.portCheckTime) < 60000) {
					skipPortcheck = true;
				}
			}

			// If cache is valid, wrap the UI rendering into the external execution path too
			if (skipPortcheck === true) {
				// runBackgroundPortCheck: set for later execute
				if (runBackgroundPortCheckExtern && typeof runBackgroundPortCheckExtern === 'object') {
					runBackgroundPortCheckExtern.execute = function () {
						if (alertData.doubleNat === true) {
							alertNode.style.setProperty('display', 'block', 'important');
						} else {
							alertNode.style.setProperty('display', 'none', 'important');
						}
						if (runBackgroundPortCheckExtern.callback && typeof runBackgroundPortCheckExtern.callback === 'function') {
							const show = (alertData.isPortValid && !alertData.isPortOpen) || (alertData.sRouteValid && alertData.sRouteMissing);
							runBackgroundPortCheckExtern.callback(show, alertData)
						}
					};
				}
				return true;
			}

			// STAGE 2: initial Rendering (show the alert box immediately as neutral INFO box)
			if (isServer) {
				await runPortForwardingSubCheck('init');
				portNode.style.setProperty('display', 'block', 'important');
				alertNode.style.setProperty('display', 'block', 'important');
			}

			// STAGE 3: runBackgroundPortCheck: if extern set for later execute or run directly
			currentExecutionToken = currentExecutionToken + 1;
			const executionToken = currentExecutionToken;
			if (runBackgroundPortCheckExtern && typeof runBackgroundPortCheckExtern === 'object') {
				runBackgroundPortCheckExtern.execute = function () {
					if (alertData.doubleNat === true) {
						runBackgroundPortCheck(executionToken, force).then(function () {
							// refresh after the background port check the visibility again (unfold or collapsed the portcheck view)
							if (runBackgroundPortCheckExtern.callback && typeof runBackgroundPortCheckExtern.callback === 'function') {
								const show = (alertData.isPortValid && !alertData.isPortOpen) || (alertData.sRouteValid && alertData.sRouteMissing);
								runBackgroundPortCheckExtern.callback(show, alertData)
							}
						});
					}
					// refresh immediatly the visibility (show collapsed by default)
					if (runBackgroundPortCheckExtern.callback && typeof runBackgroundPortCheckExtern.callback === 'function') {
						runBackgroundPortCheckExtern.callback(false, alertData)
					}
				};
			} else {
				runBackgroundPortCheck(executionToken, force);
			}

			return true;
		}
	};
}

/**
 * Converts a wizard scenario string into the official server or client role definition.
 */
const getRoleFromScenarioValue = function (scenarioValue) {
	const isAnyServer = (scenarioValue === OPENVPN.SCENARIO.CONNECT_SERVER || scenarioValue === OPENVPN.SCENARIO.SITE_TO_SITE_SERVER);
	if (isAnyServer) {
		return OPENVPN.ROLE.SERVER;
	} else {
		return OPENVPN.ROLE.CLIENT;
	}
}

/**
 * Supported message types: 'error' (red), 'ok' (green), 'info' (blue), 'warning' (yellow/orange).
 */
const MESSAGE_TYPE = Object.freeze({
	OK: 'ok',
	INFO: 'info',
	ERROR: 'error',
	WARNING: 'warning'
});

/**
 * Shows an inline status message inside the wizard.
 */
const showMessage = function (text, type, box) {
	if (!box) {
		return;
	}

	// Clear old text or old action buttons
	box.innerHTML = '';

	// Default system colors matching official LuCI framework tokens
	let activeColor = 'var(--primary-color-high, #1976d2)';
	let bgPercent = '10%';

	// Switch color tokens based on the strict frozen MESSAGE_TYPE
	if (type === MESSAGE_TYPE.ERROR) {
		activeColor = 'var(--success-color-high, #00ac59)';
	} else if (type === MESSAGE_TYPE.OK) {
		activeColor = 'var(--success-color-high, #00ac59)';
	} else if (type === MESSAGE_TYPE.WARNING) {
		activeColor = 'var(--warn-color-high, #efbd0b)';
		bgPercent = '18%';
	} else if (type === MESSAGE_TYPE.INFO) {
		activeColor = 'var(--primary-color-high, #1976d2)';
	}

	// Dynamically mix the background transparency based on the selected color token
	const activeBg = 'color-mix(in srgb, ' + activeColor + ' ' + bgPercent + ', transparent)';

	// Build a clean, styled message block matching LuCI guidelines
	const innerBlock = E('div', {
		'style': 'padding:10px; border-radius:4px; font-weight:bold; font-size:13px; line-height:1.5; ' +
			'font-family:var(--font-monospace, monospace); ' +
			'border-left:4px solid ' + activeColor + '; ' +
			'background:' + activeBg + '; ' +
			'color:var(--text-color-high, #3f3f46);'
	}, text);

	box.appendChild(innerBlock);
	box.style.setProperty('display', 'block', 'important');
};


const hideMessage = function (box) {
	box.style.setProperty('display', 'none', 'important');
}


/*
 * --- IMPORT / EXPORT  ---
 */


/**
 * Reads and saves an uploaded file or updates keys for a client vpn.
 */
const importClientInstance = async function (elements, wizardData, nextBtn, prevBtn) {
	const optSiteClient = elements.subNodes.siteClient;
	const displayNameInput = elements.inputs.displayName;
	if (!optSiteClient.validate(false)) {
		return;
	}

	// Disable buttons so the user cannot click twice during import
	nextBtn.disabled = true;
	prevBtn.disabled = true;
	nextBtn.textContent = ICON.LOADING + TXT.INFO.importing_profile;
	nextBtn.classList.remove('cbi-input-invalid');

	const activeSubParams = elements.subNodes.siteClient.getParams();
	const cleanCustomName = sanitizeInputLine(displayNameInput.value);
	let targetInstanceId = 'instance' + wizardData.instanceNumber;

	if (cleanCustomName && cleanCustomName.match(/^instance\d+$/i)) {
		targetInstanceId = cleanCustomName.toLowerCase();
	}

	if (typeof wizardData.importOvpnClientProfileCallback !== 'function') {
		return;
	}

	try {
		const extractedParams = await wizardData.importOvpnClientProfileCallback(
			activeSubParams.importedRawOvpn,
			targetInstanceId
		);

		// Path A: Update security keys only
		if (extractedParams.isCryptoUpdateOnly === true) {
			L.ui.hideModal();
			await new Promise(window.requestAnimationFrame);
			await new Promise(window.requestAnimationFrame);

			L.ui.addNotification(null, E('p', {}, TXT.MSG.keys_updated_successfully), 'ok');

			if (typeof wizardData.uciSaveApplyRestartCallback === 'function') {
				wizardData.uciSaveApplyRestartCallback(targetInstanceId);
			}
			return;
		}

		// Path B: Full setup for a brand new profile installation
		const wizardParams = Object.assign({}, WIZARD_PARAMS_TEMPLATE, {
			clients: [],
			role: OPENVPN.ROLE.CLIENT,
			port: extractedParams.port,
			proto: extractedParams.proto,
			displayName: extractedParams.cname || cleanCustomName || TXT.INFO.imported_clients,
			strategy: OPENVPN.STRATEGY.STANDARD,
			remoteServer: extractedParams.remoteServer,
			remoteServerLan: extractedParams.remoteServerLan,
			isApMode: false,
			ddnsOrPublicIp: '',
			importedRawOvpn: activeSubParams.importedRawOvpn || ''
		});

		if (typeof wizardData.addNewInstanceCallback === 'function') {
			L.ui.hideModal();
			await new Promise(window.requestAnimationFrame);
			await new Promise(window.requestAnimationFrame);
			await wizardData.addNewInstanceCallback(wizardParams.role, wizardData.appData, wizardParams);
		}
	} catch (err) {
		// Reset buttons instantly so the user can try another file right away
		nextBtn.classList.add('cbi-input-invalid');
		nextBtn.disabled = false;
		prevBtn.disabled = false;
		nextBtn.textContent = TXT.BTN.next + ' ' + ICON.ARROW;

		// NEW: Use the global showMessage function with elements.info.messageBox
		const errorContent = E('div', {}, [
			E('strong', {}, ICON.ERROR + ' ' + TXT.INFO.imported_failed),
			E('p', { 'style': 'margin-top:4px;' }, err.message)
		]);

		showMessage(errorContent, MESSAGE_TYPE.ERROR, elements.info.messageBox);
	}
};

/**
 * Puts all settings together and creates the OpenVPN server.
 */
const createServerInstance = async function (scenarioSelect, elements, protoSelect, wizardData, nextBtn, prevBtn) {
	const scenario = scenarioSelect.value;
	nextBtn.disabled = true;
	prevBtn.disabled = true;
	nextBtn.textContent = ' ' + TXT.INFO.creating_vpn;

	let activeSubParams = {};
	if (scenario === OPENVPN.SCENARIO.CONNECT_SERVER) {
		activeSubParams = elements.subNodes.connectServer.getParams();
	}
	if (scenario === OPENVPN.SCENARIO.SITE_TO_SITE_SERVER) {
		activeSubParams = elements.subNodes.siteServer.getParams();
	}

	const internalPortVal = parseInt(sanitizeInputLine(elements.inputs.port.value), 10) || (wizardData.appData.statusClass.calcPortFromId(null, wizardData.instanceNumber));
	const externalPortVal = elements.inputs.externPort ? (parseInt(sanitizeInputLine(elements.inputs.externPort.value), 10) || internalPortVal) : internalPortVal;
	const connType = elements.inputs.connectionType.value;

	let provider = '';
	let url = '';
	let domain = '';
	let publicIpOrDomain = ''; // Cleaned buffer for the raw IP/Domain input field

	// PATH A: If Dynamic DNS is selected, clean the ddnsDomain input field
	if (connType === OPENVPN.CONN_TYPE.DDNS) {
		provider = elements.inputs.ddnsProvider.value;
		const rawDomain = sanitizeInputLine(elements.inputs.ddnsDomain.value);
		domain = await wizardData.networkCallbacks.cleanIpOrDomain(rawDomain);
		let token = '';
		let ddnsUser = '';
		if (provider === 'custom') {
			if (elements.inputs.ddnsCustomUrl) {
				ddnsUser = sanitizeInputLine(elements.inputs.ddnsCustomUrl.value);
			}
		}
		else {
			token = sanitizeInputLine(elements.inputs.ddnsToken.value);
			if (elements.inputs.ddnsUsername) {
				ddnsUser = sanitizeInputLine(elements.inputs.ddnsUsername.value);
			}
		}

		url = await buildDdnsUpdateUrl(provider, domain, token, ddnsUser, wizardData, null);

	}
	// PATH B: If standard IP connection is selected, clean the ddns input field
	else {
		const rawIpOrDomain = sanitizeInputLine(elements.inputs.ddns.value);
		// clean the raw IP or connection host field
		publicIpOrDomain = await wizardData.networkCallbacks.cleanIpOrDomain(rawIpOrDomain);
	}

	// Assemble only the structural parameters required by the system
	const wizardParams = Object.assign({}, WIZARD_PARAMS_TEMPLATE, {
		role: OPENVPN.ROLE.SERVER,
		port: internalPortVal,
		portExtern: activeSubParams.isApMode ? externalPortVal : internalPortVal,
		proto: protoSelect.value,
		displayName: sanitizeInputLine(elements.inputs.displayName.value),
		strategy: activeSubParams.strategy || OPENVPN.STRATEGY.STANDARD,
		clients: Array.isArray(activeSubParams.clients) ? activeSubParams.clients : [],
		isApMode: activeSubParams.isApMode,
		connectionType: connType,
		// SMART ROUTING: Passes the correctly cleaned field based on connection type selection
		ddnsOrPublicIp: connType === OPENVPN.CONN_TYPE.DDNS ? domain : publicIpOrDomain,
		isStaticIp: elements.inputs.isStatic.checked,
		ddnsProvider: provider,
		ddnsUrl: url
	});
	if (typeof wizardData.addNewInstanceCallback === 'function') {
		L.ui.hideModal();
		await new Promise(window.requestAnimationFrame);
		await new Promise(window.requestAnimationFrame);
		try {
			await wizardData.addNewInstanceCallback(wizardParams.role, wizardData.appData, wizardParams);
		} catch (err) {
			L.ui.addNotification(null, E('p', {}, TXT.ERROR.create_openvpn_server + ' ' + err.message), 'error');
		}
	}
};


/*
 * --- SETUP WIZARD ---
 */


/**
 * OPTION 1: Mobile Devices & Laptops (OpenVPN Connect App)
 */
const renderOptionConnectServer = function (portForwardingAlert) {
	// Create two simple radio buttons to choose the internet traffic rule
	const radioRedirect = E('input', { 'type': 'radio', 'name': 'wizard_strategy_group', 'value': OPENVPN.STRATEGY.REDIRECT, 'checked': 'checked', 'style': 'width:18px; height:18px; margin:0; cursor:pointer;' });
	const radioLanOnly = E('input', { 'type': 'radio', 'name': 'wizard_strategy_group', 'value': OPENVPN.STRATEGY.STANDARD, 'style': 'width:18px; height:18px; margin:0; cursor:pointer;' });

	// Build the HTML layout block with simple labels
	const node = E('div', { 'style': 'margin-bottom:15px;' }, [
		E('div', { 'class': 'cbi-value' }, [
			E('label', { 'class': 'cbi-value-title' }, TXT.INFO.internet_traffic),
			E('div', { 'class': 'cbi-value-field', 'style': 'width:100%; display:flex; flex-direction:column; gap:10px; padding-top:4px;' }, [
				E('label', { 'style': 'display:inline-flex; align-items:center; cursor:pointer; font-weight:bold;' }, [
					radioRedirect,
					E('span', { 'style': 'margin-left:8px;' }, [ICON.SHIELD + TXT.INFO.secure_tunnel])
				]),
				E('label', { 'style': 'display:inline-flex; align-items:center; cursor:pointer; font-weight:bold;' }, [
					radioLanOnly,
					E('span', { 'style': 'margin-left:8px;' }, [ICON.SPLIT + TXT.INFO.split_tunnel])
				]),
				E('div', { 'class': 'cbi-value-description', 'style': 'margin-top:6px; margin-left:0; padding-left:0; color:color-mix(in srgb, var(--text-color-medium, #71717a) 85%, #0055ff)' }, TXT.MSG.choose_how_send_through_vpn)
			])
		]),
		// Inject the physical HTML element from the alert component framework
		portForwardingAlert.node
	]);

	// Return data and functions back to the main wizard framework
	return {
		node: node,

		// No special field check needed for this option, always return true
		validate: function () { return true; },

		getParams: function () {
			return {
				role: OPENVPN.ROLE.SERVER,
				strategy: radioRedirect.checked ? OPENVPN.STRATEGY.REDIRECT : OPENVPN.STRATEGY.STANDARD,
				isApMode: portForwardingAlert.isAlertActive()
			};
		}
	};
};

/**
 * OPTION 2: OpenVPN Server LAN-to-LAN (Main Headquarters Multi-Client)
 */
const renderOptionSiteServer = function (portForwardingAlert, wizardData) {
	// 1. Create the main HTML box
	const containerNode = E('div', { 'id': 'wizard_site_server_container' });

	// This list stores all added remote offices
	let clients = [];

	// 2. Short description at the top
	containerNode.appendChild(E('div', { 'class': 'cbi-section-descr', 'style': 'margin-bottom:15px; font-size:12px;' }, [ICON.LINK + TXT.MSG.add_your_other_office]));

	// 3. Create the table to show added offices
	const tableBody = E('tbody');
	const branchesTable = E('table', { 'class': 'table cbi-section-table', 'style': 'width:100%; margin-bottom:15px; text-align:left;' }, [
		E('thead', {}, [
			E('tr', { 'class': 'cbi-section-table-titles' }, [
				E('th', { 'class': 'cbi-section-table-cell' }, [TXT.INFO.remote_name]),
				E('th', { 'class': 'cbi-section-table-cell' }, [TXT.INFO.remote_lan_subnet]),
				E('th', { 'class': 'cbi-section-table-cell' }, [TXT.INFO.netmask]),
				E('th', { 'class': 'cbi-section-table-cell', 'style': 'width:10%; text-align:right;' }, [TXT.INFO.action])
			])
		]),
		tableBody
	]);

	// Creates a row in the table for an office
	const renderClientRow = function (clientItem, index) {
		const deleteBtn = E('button', {
			'class': 'cbi-button cbi-button-remove',
			'title': TXT.MSG.delete_this_profile
		}, [ICON.REMOVE + TXT.BTN.delete]);

		// Remove the office from the list when clicking delete
		deleteBtn.addEventListener('click', function (ev) {
			ev.preventDefault();
			clients.splice(index, 1);
			refreshTableDisplay();
		});

		return E('tr', { 'class': 'cbi-section-table-row' }, [
			E('td', { 'style': 'font-family:monospace; font-weight:bold;' }, [clientItem.commonName]),
			E('td', { 'style': 'font-family:monospace;' }, [clientItem.subnet]),
			E('td', { 'style': 'font-family:monospace;' }, [clientItem.mask]),
			E('td', { 'style': 'text-align:right;' }, [deleteBtn])
		]);
	};


	// Updates the table display
	const refreshTableDisplay = function () {
		tableBody.innerHTML = '';

		if (clients.length === 0) {
			tableBody.appendChild(E('tr', {}, [
				E('td', { 'colspan': '4', 'style': 'text-align:center; font-style:italic; padding:15px; color:color-mix(in srgb, var(--text-color-medium, #71717a) 85%, #0055ff);' }, [
					TXT.MSG.no_offices_added_yet
				])
			]));
			branchesTable.style.display = 'none';
		} else {
			clients.forEach(function (client, idx) {
				tableBody.appendChild(renderClientRow(client, idx));
			});
			branchesTable.style.display = 'table';
		}
	};

	// 4. Load the input fields row component
	const networkInputComponent = renderSubnetInputs();

	// 5. Create the "Add" button
	const addEntryBtn = E('button', {
		'class': 'cbi-button cbi-button-add',
		'style': 'margin-top:8px; margin-bottom:20px; font-weight:bold;'
	}, [ICON.PLUS + TXT.BTN.add_office]);

	// 6. Create the red error box below the button
	const errorDisplayNode = E('div', {
		'style': 'display:none; margin-top:10px; margin-bottom:15px; padding:10px; border-left:4px solid var(--success-color-high, #00ac59); background:color-mix(in srgb, var(--success-color-high, #00ac59) 10%, transparent); color:var(--success-color-high, #00ac59); font-weight:bold; border-radius:4px; font-size:13px;'
	});

	// When clicking the "Add Office" button
	addEntryBtn.addEventListener('click', function (ev) {
		ev.preventDefault();
		errorDisplayNode.style.display = 'none';

		const validatedData = networkInputComponent.validateAndFetchData();
		if (!validatedData) {
			// Stop if input syntax is wrong (field turns red)
			return;
		}

		// Run the asynchronous network state tracker check
		wizardData.networkCallbacks.checkNetworkStructure(wizardData.appData).then(function (networkState) {
			const blockedSubnets = networkState.localSubnets || [];

			// HARD PROTECTION: Check if input matches any local LAN or WAN network range
			let invalidSubNet = false;
			blockedSubnets.forEach(function (subnet) {
				if (subnet.indexOf(validatedData.subnet) !== -1) {
					errorDisplayNode.innerHTML = ICON.WARNING + TXT.ERROR.use_local_ipnetwork
					errorDisplayNode.style.display = 'block';
					networkInputComponent.fields.sub.classList.add('cbi-input-invalid');
					invalidSubNet = true;
					return;
				}
			});
			if (invalidSubNet == true) {
				return;
			}

			// Check for duplicate names inside the active memory list
			const isDuplicateCN = clients.some(function (c) {
				return c.commonName.toLowerCase() === validatedData.commonName.toLowerCase();
			});

			// Check for duplicate IP networks inside the active memory list
			const isDuplicateSubnet = clients.some(function (c) {
				return c.subnet === validatedData.subnet;
			});

			if (isDuplicateCN) {
				errorDisplayNode.innerHTML = ICON.WARNING + TXT.ERROR.office_name_already_exist;
				errorDisplayNode.style.display = 'block';
				return;
			}

			if (isDuplicateSubnet) {
				errorDisplayNode.innerHTML = ICON.WARNING + TXT.ERROR.ip_used_on_other_office;
				errorDisplayNode.style.display = 'block';
				return;
			}

			// Save the verified office data to the list
			clients.push({
				commonName: validatedData.commonName,
				subnet: validatedData.subnet,
				mask: validatedData.mask
			});

			// Clear text boxes for the next entry
			networkInputComponent.fields.cn.value = '';
			networkInputComponent.fields.sub.value = '';
			networkInputComponent.fields.mask.value = '';

			refreshTableDisplay();
			networkInputComponent.fields.cn.focus();
		}).catch(function () {
			errorDisplayNode.innerHTML = ICON.WARNING + TXT.ERROR.net_status_check;
			errorDisplayNode.style.display = 'block';
		});
	});

	// 7. Add all built elements to the main container box
	containerNode.appendChild(branchesTable);
	containerNode.appendChild(networkInputComponent.node);
	containerNode.appendChild(addEntryBtn);
	containerNode.appendChild(errorDisplayNode);

	refreshTableDisplay();

	// 8. Return data back to the main wizard framework
	return {
		node: containerNode,

		// This validation interceptor runs automatically when clicking the main "Next" button
		validate: function () {
			errorDisplayNode.style.display = 'none';

			const cnVal = sanitizeInputLine(networkInputComponent.fields.cn.value);
			const subVal = sanitizeInputLine(networkInputComponent.fields.sub.value);
			const maskVal = sanitizeInputLine(networkInputComponent.fields.mask.value);

			// Case A: All input text boxes are empty
			if (cnVal === '' && subVal === '' && maskVal === '') {
				if (clients.length === 0) {
					errorDisplayNode.innerHTML = ICON.WARNING + TXT.ERROR.add_at_least_one_office;
					errorDisplayNode.style.display = 'block';
					networkInputComponent.fields.cn.focus();
					return false; // Blocks navigation to step 3
				}
				// List has items, progression permitted
				return true;
			}

			// Case B: User filled out fields but forgot to click the "Add Office" button
			const validatedData = networkInputComponent.validateAndFetchData();
			if (!validatedData) {
				// Input check failed, block step transition
				return false;
			}

			// Since validate() must be synchronous in LuCI view hooks, we check against the
			// last cached state or block unsafe inline commits to enforce hitting the Add button.
			errorDisplayNode.innerHTML = ICON.WARNING + TXT.WARNING.unsaved_text_input;
			errorDisplayNode.style.display = 'block';
			// Guard routing loop safely
			return false;
		},

		getParams: function () {
			return {
				role: OPENVPN.ROLE.SERVER,
				strategy: OPENVPN.STRATEGY.SITETOSITE,
				isApMode: portForwardingAlert.isAlertActive(),
				clients: clients
			};
		}
	};
};

/**
 * OPTION 3: OpenVPN Client LAN-to-LAN (Branch Office) - Supports full .ovpn and naked multi-key .crt rotation.
 */
const renderOptionSiteClient = function (buttons, messageBox) {
	// 1. The structural raw file input (hidden from the user)
	const fileInput = E('input', {
		'type': 'file',
		'accept': '.ovpn,.crt',
		'style': 'display: none;'
	});

	// 2. The new styled LuCI/Bootstrap replacement button containing the icon
	const customUploadBtn = E('button', {
		'class': 'cbi-button cbi-button-neutral',
		'style': 'margin-right: 10px; font-weight: bold; min-width: 140px;',
		'click': function (clickEv) {
			clickEv.preventDefault();
			// Forwards the click into the hidden file input layer safely
			fileInput.click();
		}
	}, [ICON.IMPORT + TXT.BTN.choose_file]);

	// 3. Dynamic label element showing the selected filename text line
	const fileNameLabel = E('span', {
		'style': 'font-style: italic; font-size: 13px; color:color-mix(in srgb, var(--text-color-medium, #71717a) 85%, #0055ff);'
	}, TXT.MSG.no_file_choosen);

	// 4. Flexbox wrapper aligning our custom button and the filename label perfectly
	const uploadWrapperField = E('div', {
		'style': 'display: inline-flex; align-items: center; width: 100%;'
	}, [
		fileInput,
		customUploadBtn,
		fileNameLabel
	]);

	if (buttons && buttons.next) {
		buttons.next.disabled = true;
	}

	let uploadedFileContentStr = '';

	// When the user selects a file (triggered after selecting via the custom button)
	fileInput.addEventListener('change', function (ev) {
		fileInput.classList.remove('cbi-input-invalid');
		// Clear custom button error track
		customUploadBtn.classList.remove('cbi-input-invalid');

		if (buttons && buttons.next) {
			buttons.next.disabled = true;
		}

		const files = ev.target.files;
		if (!files || files.length === 0) {
			fileNameLabel.textContent = TXT.MSG.no_file_choosen;
			if (messageBox) hideMessage(messageBox);
			uploadedFileContentStr = '';
			return;
		}

		// Update the custom label text dynamically with the real filename
		fileNameLabel.textContent = files[0].name;

		const fileNameString = String(files[0].name || '').toLowerCase();
		const isCrtExtension = fileNameString.endsWith('.crt');

		const reader = new FileReader();
		reader.onload = function (e) {
			const text = sanitizeInputText(e.target.result);

			if (!text) {
				fileInput.classList.add('cbi-input-invalid');
				// Mark custom button red on failure
				customUploadBtn.classList.add('cbi-input-invalid');
				fileInput.value = '';
				fileNameLabel.textContent = TXT.MSG.no_file_choosen;
				if (messageBox) hideMessage(messageBox);
				uploadedFileContentStr = '';
				return;
			}

			const remoteServerMatch = text.match(/^remote\s+(\S+)\s+(\d+)/m);
			const protoMatch = text.match(/^proto\s+(\S+)/m);
			const hasCaTag = (text.indexOf('<ca>') !== -1);

			if (remoteServerMatch) {
				// PATH A: Valid full configuration profile (.ovpn)
				uploadedFileContentStr = text;

				const successContent = E('div', {}, [
					E('strong', {}, ICON.SUCCESS + ' ' + TXT.INFO.openvpn_profile_valid),
					E('br'),
					E('span', {}, [
						ICON.ARROW + ' ' + TXT.INFO.server_address + ': ',
						E('code', { 'style': 'font-weight:bold; color:var(--primary-color-high, #1976d2);' },
							remoteServerMatch[1] + ':' + remoteServerMatch[2] + ' (' + (protoMatch ? protoMatch[1] : OPENVPN.PROTO.UDP) + ')'
						)
					])
				]);

				showMessage(successContent, MESSAGE_TYPE.OK, messageBox);

				if (buttons && buttons.next) {
					buttons.next.disabled = false;
				}
			}
			else if (isCrtExtension === true || (hasCaTag === true && !remoteServerMatch)) {
				// PATH B: Valid cryptographic multi-key bundle (.crt)
				uploadedFileContentStr = text;

				const warningContent = E('div', {}, [
					E('strong', {}, ICON.WARNING + ' ' + TXT.WARNING.openvpn_key_detected),
					E('br'),
					E('span', { 'style': 'color:var(--success-color-high, #00ac59); font-weight:bold;' }, ICON.ARROW + ' ' + TXT.INFO.key_update_active),
					E('br'),
					E('span', {}, TXT.MSG.only_vpn_client_keys),
					E('br'),
					E('span', { 'style': 'color:var(--success-color-high, #00ac59); font-weight:bold;' }, TXT.WARNING.upload_wrong_keys)
				]);


				showMessage(warningContent, MESSAGE_TYPE.WARNING, messageBox);

				if (buttons && buttons.next) {
					buttons.next.disabled = false;
				}
			}
			else {
				// PATH C: File is corrupted or missing vital fields
				fileInput.classList.add('cbi-input-invalid');
				customUploadBtn.classList.add('cbi-input-invalid');
				fileInput.value = '';
				fileNameLabel.textContent = TXT.MSG.no_file_choosen;
				// Build a clean, styled DOM element block for the dynamic error container
				const corruptedFileError = E('div', {}, [
					E('strong', {}, ICON.ERROR + ' ' + TXT.ERROR.file_corrupted),
					E('p', { 'style': 'margin-top:4px;' }, TXT.MSG.please_check_profe_file)
				]);
				showMessage(corruptedFileError, MESSAGE_TYPE.ERROR, messageBox);
				uploadedFileContentStr = '';
			}
		};
		reader.readAsText(files[0]);
	});

	// 5. Build the clean HTML row block layout structure
	const node = E('div', { 'style': 'margin-bottom:15px;' }, [
		E('div', { 'class': 'cbi-value' }, [
			// Left side title row label is now clean and clear
			E('label', { 'class': 'cbi-value-title' }, TXT.INFO.import_profile),
			E('div', { 'class': 'cbi-value-field' }, [
				uploadWrapperField,
				E('div', { 'class': 'cbi-value-description', 'style': 'margin-top:4px; color:color-mix(in srgb, var(--text-color-medium, #71717a) 85%, #0055ff);' }, TXT.MSG.select_ovpn_profile)
			])
		])
	]);

	return {
		node: node,
		validate: function (newStep) {
			fileInput.classList.remove('cbi-input-invalid');
			customUploadBtn.classList.remove('cbi-input-invalid');
			if (!uploadedFileContentStr) {
				if (!newStep) {
					fileInput.classList.add('cbi-input-invalid');
					customUploadBtn.classList.add('cbi-input-invalid');
				}
				return false;
			}
			return true;
		},
		getParams: function () {
			return {
				role: OPENVPN.ROLE.CLIENT,
				strategy: OPENVPN.STRATEGY.STANDARD,
				importedRawOvpn: uploadedFileContentStr
			};
		}
	};
};

/**
 * Builds the HTML layout block for Step 1 (VPN Name and Selection)
 */
const buildWizardStep1Row = function (displayNameInput, radioConnectServer, radioSiteServer, radioSiteClientMatrix, hideClient) {

	let styleHide = '';
	if (hideClient === true) {
		styleHide = ' display:none !important;';
	}

	return E('div', { 'style': 'display:block; margin-bottom:15px;' }, [
		// Row A: Choose a custom name for the VPN instance
		E('div', { 'class': 'cbi-value' }, [
			E('label', { 'class': 'cbi-value-title' }, TXT.INFO.vpn_name),
			E('div', { 'class': 'cbi-value-field' }, [displayNameInput])
		]),

		// Row B: Select the VPN connection type
		E('div', { 'class': 'cbi-value' }, [
			E('label', { 'class': 'cbi-value-title', 'style': 'margin-bottom:10px; display:block;' }, TXT.INFO.select_vpn_type),
			E('div', { 'class': 'cbi-value-field', 'style': 'display:flex; flex-direction:column; gap:12px; padding-left:2px;' }, [

				// Option 1: Server for mobile clients
				E('label', { 'style': 'display:inline-flex; align-items:center; cursor:pointer; font-weight:bold;' }, [
					radioConnectServer,
					E('span', { 'style': 'margin-left:8px;' }, ICON.PHONE + TXT.MSG.for_phones_and_laptops)
				]),

				// Option 2: Server for main office
				E('label', { 'style': 'display:inline-flex; align-items:center; cursor:pointer; font-weight:bold;' }, [
					radioSiteServer,
					E('span', { 'style': 'margin-left:8px;' }, ICON.OFFICE + TXT.MSG.server_for_main_office)
				]),

				// Option 3: Client for branch office
				E('label', { 'style': 'display:inline-flex; align-items:center; cursor:pointer; font-weight:bold;' + styleHide }, [
					radioSiteClientMatrix,
					E('span', { 'style': 'margin-left:8px;' }, ICON.BRANCH + TXT.MSG.client_for_branch_office)
				])

			])
		])
	]);
};

/**
 * Builds the step 2 container row encapsulating all scenario sub-nodes
 */
const buildWizardStep2Row = function (optConnectServerNode, optSiteServerNode, optSiteClientNode) {
	return E('div', { 'style': 'display:none; margin-bottom:15px;' }, [
		optConnectServerNode,
		optSiteServerNode,
		optSiteClientNode
	]);
};

/**
 * Builds the HTML layout block for Step 3 (Network and Port Settings).
 */
const buildWizardStep3Row = function (elements_inputs, radioUdp, radioTcp, buttons, apModeAlertNode) {
	const ipContainer = E('div', { 'id': 'ovpn_wizard_ip_block', 'style': 'display:block; opacity:1; transition:opacity 0.3s ease;' });
	const ddnsContainer = E('div', { 'id': 'ovpn_wizard_ddns_block', 'style': 'display:none; opacity:0; transition:opacity 0.3s ease;' });

	// Assemble the IP
	ipContainer.append(
		E('div', { 'class': 'cbi-value', 'style': 'margin-top:12px;' }, [
			E('label', { 'class': 'cbi-value-title' }, TXT.INFO.public_ip_or_domain),
			E('div', { 'class': 'cbi-value-field' }, [
				elements_inputs.ddns,
				E('div', { 'class': 'cbi-value-description', 'style': 'margin-top:4px; color:color-mix(in srgb, var(--text-color-medium, #71717a) 85%, #0055ff);' }, TXT.MSG.public_ip_or_domainname)
			])
		]),
		E('div', { 'class': 'cbi-value' }, [
			E('label', { 'class': 'cbi-value-title' }, TXT.INFO.public_static_ip),
			E('div', { 'class': 'cbi-value-field' }, [
				elements_inputs.isStatic,
				E('div', { 'class': 'cbi-value-description' }, [
					E('span', { 'class': 'cbi-value-helpicon', 'style': 'color:color-mix(in srgb, var(--text-color-medium, #71717a) 85%, #0055ff);', 'title': TXT.INFO.help }, TXT.MSG.internet_provides_static_ip)
				])
			])
		])
	);

	const togglePasswordBtn = E('button', {
		'class': 'cbi-button cbi-button-neutral',
		'style': 'margin-left: calc(-.2em + -2px); border-radius: 0 3px 3px 0; padding: 0 6px; font-weight: bold;',
		'title': TXT.INFO.reveal_hide_password,
		'aria-label': TXT.INFO.reveal_hide_password,
		'click': function (ev) {
			ev.preventDefault();
			if (elements_inputs.ddnsToken.type === 'password') {
				elements_inputs.ddnsToken.type = 'text';
			} else {
				elements_inputs.ddnsToken.type = 'password';
			}
		}
	}, ['∗']);

	const ddnsUsernameContainer = E('div', { 'id': 'ddns_username_container', 'class': 'cbi-value', 'style': 'display:none !important' }, [
		// set No-Ip (noip.com) default
		E('label', { 'id': 'ddns_username_label', 'class': 'cbi-value-title', 'style': 'word-break: keep-all; hyphens: none;' }, TXT.DDNS.noip_username),
		E('div', { 'class': 'cbi-value-field' }, [elements_inputs.ddnsUsername])
	]);
	const ddnsTokenContainer = E('div', { 'class': 'cbi-value' }, [
		E('label', { 'id': 'ddns_token_label', 'class': 'cbi-value-title', 'style': 'word-break: keep-all; hyphens: none;' }, TXT.DDNS.duckdns_token),
		E('div', { 'class': 'cbi-value-field', 'style': 'display:flex; width:100%;' }, [
			elements_inputs.ddnsToken,
			togglePasswordBtn
		])
	]);
	const ddnsCustomUrlContainer = E('div', { 'class': 'cbi-value', 'style': 'display:none !important; word-break: keep-all; hyphens: none;' }, [
		E('label', { 'class': 'cbi-value-title' }, TXT.INFO.custom_update_url),
		E('div', { 'class': 'cbi-value-field' }, [elements_inputs.ddnsCustomUrl])
	]);


	// Assemble the Dynamic DNS Section
	ddnsContainer.append(
		E('div', { 'class': 'cbi-value', 'style': 'margin-top:12px;' }, [
			E('label', { 'class': 'cbi-value-title' }, TXT.INFO.ddns_provider),
			E('div', { 'class': 'cbi-value-field' }, [
				elements_inputs.ddnsProvider,
				// Inject ICON.INFO in cbi-value-description
				E('div', { 'id': 'ddns_provider_description', 'style': 'margin-top:4px; color:color-mix(in srgb, var(--text-color-medium, #71717a) 85%, #0055ff);' }, [
					E('a', { 'href': TXT.DDNS.duckdns_link, 'target': '_blank', 'rel': 'noopener noreferrer', 'style': 'margin-right: 4px; display: inline-flex; align-items: center; text-decoration: none !important; cursor: pointer; border: none !important;' }, [ICON.GLOBE]),
					E('span', {}, TXT.DDNS.duckdns_description)
				]),
			]),
		]),
		E('div', { 'class': 'cbi-value' }, [
			E('label', { 'class': 'cbi-value-title' }, TXT.INFO.domain_name),
			E('div', { 'class': 'cbi-value-field' }, [elements_inputs.ddnsDomain])
		]),
		ddnsUsernameContainer,
		ddnsTokenContainer,
		ddnsCustomUrlContainer
	);

	// Toggle Visibility between IP and DDNS Blocks
	elements_inputs.connectionType.addEventListener('change', function () {

		lockCreateButton(buttons);

		if (this.value === OPENVPN.CONN_TYPE.IP) {
			ddnsContainer.style.setProperty('display', 'none');
			ddnsContainer.style.setProperty('opacity', '0');
			ipContainer.style.setProperty('display', 'block');
			setTimeout(function () { ipContainer.style.setProperty('opacity', '1'); }, 10);
		} else {
			ipContainer.style.setProperty('display', 'none');
			ipContainer.style.setProperty('opacity', '0');
			ddnsContainer.style.setProperty('display', 'block');
			setTimeout(function () { ddnsContainer.style.setProperty('opacity', '1'); }, 10);
		}
	});

	// Toggle Custom URL field if "Custom" provider is selected
	elements_inputs.ddnsProvider.addEventListener('change', function () {
		if (this.value === 'custom') {
			// hide the token container completely:
			ddnsTokenContainer.style.setProperty('display', 'none', 'important');
			// show the url container safely without breaking the theme layout
			ddnsCustomUrlContainer.style.removeProperty('display')
		} else {
			ddnsTokenContainer.style.removeProperty('display')
			ddnsCustomUrlContainer.style.setProperty('display', 'none', 'important');
		}
	});

	return E('div', { 'style': 'display:none; margin-bottom:15px;' }, [
		// Master Switch
		E('div', { 'class': 'cbi-value' }, [
			E('label', { 'class': 'cbi-value-title', 'id': 'ovpn_wizard_type_label' }, TXT.INFO.connection_type),
			E('div', { 'class': 'cbi-value-field' }, [elements_inputs.connectionType])
		]),

		ipContainer,
		ddnsContainer,

		E('hr', { 'style': 'margin:15px 0; border:0; border-top:1px solid var(--border-color-medium, #cbd5e1);' }),

		E('div', { 'class': 'cbi-value', 'style': 'margin-top:12px;' }, [
			E('label', { 'class': 'cbi-value-title' }, TXT.INFO.internal_port),
			E('div', { 'class': 'cbi-value-field' }, [
				elements_inputs.port,
				E('div', { 'class': 'cbi-value-description', 'style': 'margin-top:4px; color:color-mix(in srgb, var(--text-color-medium, #71717a) 85%, #0055ff);' }, TXT.MSG.port_used_this_router)
			])
		]),
		E('div', { 'class': 'cbi-value', 'id': 'row_client_port_container', 'style': 'display: none !important;' }, [
			E('label', { 'class': 'cbi-value-title' }, TXT.INFO.external_port),
			E('div', { 'class': 'cbi-value-field' }, [
				elements_inputs.externPort,
				E('div', { 'class': 'cbi-value-description', 'style': 'margin-top:4px; color:color-mix(in srgb, var(--text-color-medium, #71717a) 85%, #0055ff);' }, TXT.MSG.port_used_main_router)
			])
		]),

		E('div', { 'class': 'cbi-value' }, [
			E('label', { 'class': 'cbi-value-title' }, TXT.INFO.protocol),
			E('div', { 'class': 'cbi-value-field', 'style': 'display:inline-flex; flex-direction:column; gap:10px; padding-top:4px;' }, [
				E('label', { 'style': 'display:inline-flex; align-items:center; cursor:pointer; font-weight:bold;' }, [
					radioUdp, E('span', { 'style': 'margin-left:6px;' }, TXT.MSG.udp_performance)
				]),
				E('label', { 'style': 'display:inline-flex; align-items:center; cursor:pointer; font-weight:bold;' }, [
					radioTcp, E('span', { 'style': 'margin-left:6px; color:var(--success-color-high, #00ac59);' }, TXT.MSG.tcp_for_traveling)
				])
			])
		]),
		apModeAlertNode,
	]);
};

/**
 * Creates all the text fields, buttons, and radio controls for the wizard steps
 */
const createWizardInputElements = function (buttons, wizardData, selectedScenario, portForwardingAlert, hideClient) {
	let styleHide = '';
	if (hideClient === true) {
		styleHide = ' display:none !important;';
	}

	const radioConnect = E('input', { 'type': 'radio', 'name': 'wizard_scenario_group', 'value': OPENVPN.SCENARIO.CONNECT_SERVER, 'style': 'width:18px; height:18px; margin:0; cursor:pointer;' });
	const radioSiteServer = E('input', { 'type': 'radio', 'name': 'wizard_scenario_group', 'value': OPENVPN.SCENARIO.SITE_TO_SITE_SERVER, 'style': 'width:18px; height:18px; margin:0; cursor:pointer;' });
	const radioSiteClient = E('input', { 'type': 'radio', 'name': 'wizard_scenario_group', 'value': OPENVPN.SCENARIO.SITE_TO_SITE_CLIENT, 'style': 'width:18px; height:18px; margin:0; cursor:pointer;' + styleHide });

	const forcedScenario = wizardData.forcedScenario;


	if (selectedScenario === OPENVPN.SCENARIO.CONNECT_SERVER) {
		radioConnect.checked = true;
	}
	if (selectedScenario === OPENVPN.SCENARIO.SITE_TO_SITE_SERVER) {
		radioSiteServer.checked = true;
	}
	if (selectedScenario === OPENVPN.SCENARIO.SITE_TO_SITE_CLIENT) {
		radioSiteClient.checked = true;
	}
	if (forcedScenario) {
		radioConnect.disabled = true;
		radioSiteServer.disabled = true;
		radioSiteClient.disabled = true;
	}

	const radioUdp = E('input', { 'type': 'radio', 'name': 'wizard_proto_group', 'value': OPENVPN.PROTO.UDP, 'style': 'width:18px; height:18px; margin:0; cursor:pointer;' });
	const radioTcp = E('input', { 'type': 'radio', 'name': 'wizard_proto_group', 'value': OPENVPN.PROTO.TCP, 'style': 'width:18px; height:18px; margin:0; cursor:pointer;' });
	const displayNameInput = E('input', { 'type': 'text', 'class': 'cbi-input-text', 'placeholder': TXT.MSG.placeholder_myhomevpn, 'style': 'width:100%;' });
	const ddnsInput = E('input', { 'type': 'text', 'class': 'cbi-input-text', 'placeholder': TXT.MSG.placeholder_mydomain_publicip, 'style': 'width:100%; font-weight:bold; color:var(--primary-color-high, #1976d2);' });
	const portInput = E('input', { 'type': 'text', 'class': 'cbi-input-text', 'style': 'font-family:var(--font-monospace, monospace)' });
	const externPortInput = E('input', { 'type': 'text', 'class': 'cbi-input-text', 'style': 'font-family:var(--font-monospace, monospace)' });

	const messageBoxInfo = E('div', { 'id': 'dns_check_result_container', 'style': 'margin: 15px 0; display: none;' });

	const optConnectServer = renderOptionConnectServer(portForwardingAlert);
	const optSiteServer = renderOptionSiteServer(portForwardingAlert, wizardData);
	const optSiteClient = renderOptionSiteClient(buttons, messageBoxInfo);
	const staticIpCheckbox = E('input', { 'type': 'checkbox', 'style': 'width:18px; height:18px; margin:0; cursor:pointer;' });

	// Create the new select dropdown inputs for the connection mode handling
	const connectionTypeSelect = E('select', { 'class': 'cbi-input-select', 'style': 'width:100%; font-weight:bold;' }, [
		E('option', { 'value': OPENVPN.CONN_TYPE.IP }, TXT.MSG.use_public_ip),
		E('option', { 'value': OPENVPN.CONN_TYPE.DDNS }, TXT.MSG.use_ddns_service)
	]);

	const ddnsProviderSelect = E('select', {
		'class': 'cbi-input-select',
		'style': 'width:100%; font-weight:bold;'
	}, [

		// 1. Top Recommended
		E('option', { 'value': 'duckdns', 'data-placeholder': TXT.DDNS.duckdns_placeholder, 'data-description': TXT.DDNS.duckdns_description, 'data-link': TXT.DDNS.duckdns_link, 'data-token-label': TXT.DDNS.duckdns_token }, TXT.DDNS.duckdns_provider),
		E('option', { 'value': 'ipv64', 'data-placeholder': TXT.DDNS.ipv64_placeholder, 'data-description': TXT.DDNS.ipv64_description, 'data-link': TXT.DDNS.ipv64_link, 'data-token-label': TXT.DDNS.ipv64_token }, TXT.DDNS.ipv64_provider),
		E('option', { 'value': 'dynv6', 'data-placeholder': TXT.DDNS.dynv6_placeholder, 'data-description': TXT.DDNS.dynv6_description, 'data-link': TXT.DDNS.dynv6_link, 'data-token-label': TXT.DDNS.dynv6_token }, TXT.DDNS.dynv6_provider),
		E('option', { 'value': 'dynu', 'data-placeholder': TXT.DDNS.dynu_placeholder, 'data-description': TXT.DDNS.dynu_description, 'data-link': TXT.DDNS.dynu_link, 'data-token-label': TXT.DDNS.dynu_token, 'data-username': 'optional', 'data-username-label': TXT.DDNS.dynu_username }, TXT.DDNS.dynu_provider),

		// 2. Commercial & Legacy Standards (High compatibility but Free-Tier limitations)
		E('option', { 'value': 'noip', 'data-placeholder': TXT.DDNS.noip_placeholder, 'data-description': TXT.DDNS.noip_description, 'data-link': TXT.DDNS.noip_link, 'data-token-label': TXT.DDNS.noip_token, 'data-username': 'visible', 'data-username-label': TXT.DDNS.noip_username }, TXT.DDNS.noip_provider),

		// 3. Free no registration - may blocked by some ISP
		E('option', { 'value': 'freemyip', 'data-placeholder': TXT.DDNS.freemyip_placeholder, 'data-description': TXT.DDNS.freemyip_description, 'data-link': TXT.DDNS.freemyip_link, 'data-token-label': TXT.DDNS.freemyip_token }, TXT.DDNS.freemyip_provider),

		// 4. Manual Fallback Configuration
		E('option', { 'value': 'custom', 'data-placeholder': TXT.DDNS.custom_placeholder, 'data-description': TXT.DDNS.custom_description, 'data-token-label': TXT.DDNS.custom_token }, TXT.DDNS.custom_provider)
	]);

	const ddnsDomainInput = E('input', { 'type': 'text', 'class': 'cbi-input-text', 'placeholder': TXT.DDNS.duckdns_placeholder, 'style': 'width:100%; font-family:var(--font-monospace, monospace)' });
	const ddnsUsernameInput = E('input', { 'type': 'text', 'class': 'cbi-input-text', 'style': 'width:100%; font-family:var(--font-monospace, monospace);' });
	const ddnsTokenInput = E('input', { 'type': 'password', 'class': 'cbi-input-text cbi-input-password', 'style': 'width:100%; font-family:var(--font-monospace, monospace);' });
	const ddnsCustomUrlInput = E('input', { 'type': 'text', 'class': 'cbi-input-text', 'placeholder': TXT.DDNS.custom_url_placeholder, 'style': 'width:100%; font-family:var(--font-monospace, monospace)' });

	return {
		radios: { connectServer: radioConnect, siteServer: radioSiteServer, siteClient: radioSiteClient, udp: radioUdp, tcp: radioTcp },
		inputs: {
			displayName: displayNameInput,
			ddns: ddnsInput,
			connectionType: connectionTypeSelect,
			ddnsProvider: ddnsProviderSelect,
			ddnsDomain: ddnsDomainInput,
			ddnsUsername: ddnsUsernameInput,
			ddnsToken: ddnsTokenInput,
			ddnsCustomUrl: ddnsCustomUrlInput,
			isStatic: staticIpCheckbox,
			port: portInput,
			externPort: externPortInput
		},
		subNodes: { connectServer: optConnectServer, siteServer: optSiteServer, siteClient: optSiteClient },
		info: { messageBox: messageBoxInfo }
	};
};

/**
 * Generates the standard bottom navigation buttons for the modal flow
 */
const createWizardNavigationButtons = function () {
	return {
		prev: E('button', { 'class': 'cbi-button cbi-button-neutral', 'style': 'display:none; margin-right:10px;' }, TXT.BTN.back),
		next: E('button', { 'class': 'cbi-button cbi-button-action important', 'style': 'margin-right:10px;' }, TXT.BTN.next + ' ' + ICON.ARROW),
		check: E('button', { 'class': 'cbi-button cbi-button-action important', 'style': 'display:none; margin-right:10px;' }, ICON.GLOBE + TXT.BTN.check_address),
		create: E('button', { 'class': 'cbi-button cbi-button-action important', 'style': 'display:none; margin-right:10px;' }, ICON.WIZARD + TXT.BTN.create_vpn),
		close: E('button', { 'class': 'cbi-button cbi-button-neutral' }, TXT.BTN.cancel)
	};
};

/**
 * Changes the default ports automatically based on protocol and network type
 */
const updateDefaultWizardPorts = async function (protoValue, portForwardingAlert, portInput, externPortInput, scenario, wizardData) {
	let defaultPort;
	let defaultPortExtern;
	const isTcp = (protoValue === OPENVPN.PROTO.TCP);
	if (isTcp) {
		const ports = getPortsTcp(wizardData);
		defaultPort = ports.port
		defaultPortExtern = ports.portExtern;
	} else {
		defaultPort = String(wizardData.appData.statusClass.calcPortFromId(null, wizardData.instanceNumber));
		defaultPortExtern = defaultPort;
	}

	const role = getRoleFromScenarioValue(scenario);
	const isServer = (role === OPENVPN.ROLE.SERVER);
	let isAp = false;

	// Port tests are only needed if this machine works as a VPN server
	if (isServer) {
		try {
			const networkState = await wizardData.networkCallbacks.checkNetworkStructure(wizardData.appData);
			if (networkState.doubleNat === true || networkState.apMode === true) {
				isAp = true;
			}
		} catch {
			isAp = false;
		}
	}

	const clientPortRow = document.getElementById('row_client_port_container');
	if (clientPortRow) {
		if (isAp === true) {
			// show (remove display none !important)
			clientPortRow.style.removeProperty('display');
			clientPortRow.style.display = '';
		} else {
			// hide
			clientPortRow.style.setProperty('display', 'none', 'important');
		}
	}

	if (isTcp) {
		// HELP-RULE: If TCP is selected behind Double-NAT, auto-fill External=443 and Internal=444!
		if (isAp === true) {
			// Internal target port (444)
			portInput.value = defaultPort;
			if (externPortInput) {
				// External WAN port (443)
				externPortInput.value = defaultPortExtern;
			}
		} else {
			portInput.value = defaultPort;
			if (externPortInput) externPortInput.value = defaultPort;
		}
	} else {
		// Default standard UDP port calculation
		portInput.value = defaultPort;
		if (externPortInput) externPortInput.value = defaultPortExtern;
	}
};

/**
 * Helper to find out which VPN type is selected
 */
const getSelectedScenarioValue = function (elements) {
	if (elements.radios.connectServer.checked) return OPENVPN.SCENARIO.CONNECT_SERVER;
	if (elements.radios.siteServer.checked) return OPENVPN.SCENARIO.SITE_TO_SITE_SERVER;
	if (elements.radios.siteClient.checked) return OPENVPN.SCENARIO.SITE_TO_SITE_CLIENT;
	return OPENVPN.SCENARIO.CONNECT_SERVER;
};

/**
 * Show or hide sub-options based on the selected VPN type
 */
const syncScenarioSubNodeVisibility = function (elements) {
	const val = getSelectedScenarioValue(elements);
	elements.subNodes.connectServer.node.style.display = (val === OPENVPN.SCENARIO.CONNECT_SERVER) ? 'block' : 'none';
	elements.subNodes.siteServer.node.style.display = (val === OPENVPN.SCENARIO.SITE_TO_SITE_SERVER) ? 'block' : 'none';
	elements.subNodes.siteClient.node.style.display = (val === OPENVPN.SCENARIO.SITE_TO_SITE_CLIENT) ? 'block' : 'none';
};

/**
 * Find out if UDP or TCP is selected
 */
const getActiveProtoValue = function (elements) {
	const protoValue = elements.radios.tcp.checked ? OPENVPN.PROTO.TCP : OPENVPN.PROTO.UDP;
	return protoValue;
};

/**
 * Show or hide steps (Step 1, Step 2, Step 3) and update descriptions.
 */
const updateStepVisibility = function (elements, state, buttons, wizardData) {
	const scenario = getSelectedScenarioValue(elements);

	// Step 1: Scenario and VPN name selection landing page
	if (state.currentStep === 1) {
		state.rows.step1.style.setProperty('display', 'block', 'important');
		state.rows.step2.style.setProperty('display', 'none', 'important');
		state.rows.step3.style.setProperty('display', 'none', 'important');
		hideMessage(elements.info.messageBox);

		buttons.prev.style.setProperty('display', 'none', 'important');
		buttons.next.disabled = false;
		buttons.next.style.setProperty('display', 'inline-block', 'important');
		buttons.check.style.setProperty('display', 'none', 'important');
		buttons.create.style.setProperty('display', 'none', 'important');

		state.nodes.descr.textContent = TXT.MSG.create_vpn_few_clicks;
	}
	// Sub-step rendering configurations for active settings pages
	else if (state.currentStep === 2 || state.currentStep === 3) {
		state.rows.step1.style.setProperty('display', 'none', 'important');

		// Step 2: Advanced scenario input configurations
		if (state.currentStep === 2) {
			state.rows.step2.style.setProperty('display', 'block', 'important');
			state.rows.step3.style.setProperty('display', 'none', 'important');
			hideMessage(elements.info.messageBox);

			wizardData.forcedScenario ? buttons.prev.style.setProperty('display', 'none', 'important') : buttons.prev.style.setProperty('display', 'inline-block', 'important');
			// Lock Next button if client import has no file uploaded yet
			if (scenario === OPENVPN.SCENARIO.SITE_TO_SITE_CLIENT && !elements.subNodes.siteClient.validate(true)) {
				buttons.next.disabled = true;
			} else {
				buttons.next.disabled = false;
			}
			buttons.next.style.setProperty('display', 'inline-block', 'important');
			buttons.check.style.setProperty('display', 'none', 'important');
			buttons.create.style.setProperty('display', 'none', 'important');

			syncScenarioSubNodeVisibility(elements);
		}
		// Step 3: Public WAN and port mapping settings
		else {
			state.rows.step2.style.setProperty('display', 'none', 'important');
			state.rows.step3.style.setProperty('display', 'block', 'important');
			hideMessage(elements.info.messageBox);

			buttons.next.style.setProperty('display', 'none', 'important');
			buttons.prev.style.setProperty('display', 'inline-block', 'important');

			// Force network check verification before unlocking deployment flow
			lockCreateButton(buttons);
		}

		// Generate dynamic modal header text with context emojis
		let scenarioTitle = '';
		if (scenario === OPENVPN.SCENARIO.CONNECT_SERVER) {
			scenarioTitle = TXT.INFO.setup + ': ' + ICON.PHONE + TXT.MSG.for_phones_and_laptops;
		} else if (scenario === OPENVPN.SCENARIO.SITE_TO_SITE_SERVER) {
			scenarioTitle = TXT.INFO.setup + ': ' + ICON.OFFICE + TXT.MSG.server_for_main_office;
		} else if (scenario === OPENVPN.SCENARIO.SITE_TO_SITE_CLIENT) {
			scenarioTitle = TXT.INFO.setup + ': ' + ICON.BRANCH + TXT.MSG.client_for_branch_office;
		}

		// Append custom virtual instance tag string if filled out
		if (elements.inputs.displayName.value) {
			scenarioTitle += '\u2003\u2003' + ICON.TAG + elements.inputs.displayName.value;
		}

		state.nodes.descr.textContent = scenarioTitle;
	}
};

/**
 * Runs the check and synchronizes the external port field visibility dynamically
 */
const triggerWizardNetworkCheck = function (elements, portForwardingAlert, wizardData, force) {
	const protoStr = getActiveProtoValue(elements);
	const scenarioStr = getSelectedScenarioValue(elements);
	const roleStr = getRoleFromScenarioValue(scenarioStr);
	const internalPort = sanitizeInputLine(elements.inputs.port.value);
	const externalPort = sanitizeInputLine(elements.inputs.externPort.value);

	// Promises inside .check() handle the background thread automatically.
	return portForwardingAlert.check(protoStr, roleStr, internalPort, externalPort, null, wizardData.appData, force, null);
};

/**
 * Renders an inline interactive warning box when a dynamic IP is detected.
 */
const renderIpValidationWarning = function (elements, scenario, wizardData, buttons) {
	return E('div', {}, [
		E('p', { 'style': 'margin-bottom: 8px;' }, TXT.WARNING.no_static_ip_selected),
		E('button', {
			'class': 'cbi-button cbi-button-action important',
			'style': 'font-weight: bold; margin-right: 8px;',
			'click': function (clickEv) {
				clickEv.preventDefault();
				// Action: Switch interface to Dynamic DNS (DDNS) mode
				elements.inputs.connectionType.value = OPENVPN.CONN_TYPE.DDNS;

				const changeEvent = document.createEvent('HTMLEvents');
				changeEvent.initEvent('change', true, false);
				elements.inputs.connectionType.dispatchEvent(changeEvent);

				const typeLabel = document.getElementById('ovpn_wizard_type_label');
				if (typeLabel) {
					typeLabel.style.setProperty('color', 'var(--success-color-high, #00ac59)', 'important');
					typeLabel.style.setProperty('transition', 'color 0.5s ease');
					setTimeout(function () {
						typeLabel.style.setProperty('color', '');
					}, 2000);
				}
				elements.inputs.connectionType.focus();
				if (elements.info && elements.info.messageBox) {
					elements.info.messageBox.style.setProperty('display', 'none', 'important');
				}
				buttons.create.disabled = false;
			}
		}, TXT.MSG.switch_to_ddns),
		E('button', {
			'class': 'cbi-button cbi-button-neutral',
			'click': function (clickEv) {
				clickEv.preventDefault();
				if (!elements.inputs.isStatic.checked) {
					showMessage(ICON.INFO + TXT.MSG.ip_static_bypassed_by_admin, MESSAGE_TYPE.INFO, elements.info.messageBox);
				} else {
					showMessage(ICON.INFO + TXT.MSG.ip_static_now_checked_by_admin, MESSAGE_TYPE.INFO, elements.info.messageBox);
				}
				buttons.create.disabled = false;
			}
		}, TXT.MSG.keep_ip_setup)
	]);
};

/**
 * Evaluates existing profiles and get collision-free TCP ports
 */
const getPortsTcp = function (wizardData) {
	const instances = wizardData.appData.instances || [];

	// Default configuration for the very first travel-optimized TCP profile (Master Instance)
	let newPort = OPENVPN.PORT.s444;
	let newExterPort = OPENVPN.PORT.s443;

	if (instances && instances.length > 0) {
		let tcpInstanceCount = 0;

		// 1. Just count how many TCP instances are currently registered in total
		for (let i = 0; i < instances.length; i++) {
			if (instances[i] && instances[i].proto === OPENVPN.PROTO.TCP) {
				tcpInstanceCount++;
			}
		}

		// 2. Structural cascade based strictly on the index count
		if (tcpInstanceCount > 0) {
			// Fast mathematical block calculation starting at base 444
			const nextCalculatedPort = 444 + tcpInstanceCount;

			// Safety boundary matching your consensus to keep it safe from registered system services
			if (nextCalculatedPort >= 450) {
				newPort = wizardData.appData.statusClass.calcPortFromId(null, wizardData.instanceNumber);
				newExterPort = newPort;
			} else {
				// Cascade based strictly on instance order: Inst 1 -> 444 / 443, Inst 2 -> 445 / 445, Inst 3 -> 446 / 446...
				newPort = String(nextCalculatedPort);
				newExterPort = newPort;
			}
		}
	}

	return { port: newPort, portExtern: newExterPort };
};

/**
 * Handles the step-by-step navigation logic when clicking the Next button.
 */
const handleButtonNextClick = function (state, elements, buttons, portForwardingAlert, wizardData) {
	const scenario = getSelectedScenarioValue(elements);
	buttons.next.classList.remove('cbi-input-invalid');

	switch (state.currentStep) {
		case 1: {
			// Name Validation filter rules matching alphanumeric structures
			if (elements.inputs.displayName.value && !/^[a-zA-Z0-9_-]*$/.test(elements.inputs.displayName.value)) {
				elements.inputs.displayName.classList.add('cbi-input-invalid');
				elements.inputs.displayName.focus();

				const nameError = ICON.ERROR + ' ' + TXT.ERROR.vpn_name_validation;
				showMessage(nameError, MESSAGE_TYPE.ERROR, elements.info.messageBox);

				return;
			}
			elements.inputs.displayName.classList.remove('cbi-input-invalid');

			state.currentStep = 2;
			updateStepVisibility(elements, state, buttons, wizardData);
			syncScenarioSubNodeVisibility(elements);
		}
			break;


		case 2: {
			if (scenario === OPENVPN.SCENARIO.CONNECT_SERVER && !elements.subNodes.connectServer.validate()) return;
			if (scenario === OPENVPN.SCENARIO.SITE_TO_SITE_SERVER && !elements.subNodes.siteServer.validate()) return;

			// Handle original import and validation branches for site client offices
			if (scenario === OPENVPN.SCENARIO.SITE_TO_SITE_CLIENT) {
				importClientInstance(elements, wizardData, buttons.next, buttons.prev);
				return;
			}
			// set default tcp on mobile connect and udp on site to site
			if (scenario === OPENVPN.SCENARIO.CONNECT_SERVER) {

				elements.radios.tcp.checked = true;
				elements.radios.udp.checked = false;
				const ports = getPortsTcp(wizardData);
				elements.inputs.port.value = ports.port
				elements.inputs.externPort.value = ports.portExtern;
			} else {
				elements.radios.tcp.checked = false;
				elements.radios.udp.checked = true;
				elements.inputs.port.value = String(wizardData.appData.statusClass.calcPortFromId(null, wizardData.instanceNumber));
				elements.inputs.externPort.value = elements.inputs.port.value;
			}
			elements.inputs.port.placeholder = TXT.INFO.placeholder_eg + ' ' + elements.inputs.port.value;
			elements.inputs.externPort.placeholder = TXT.INFO.placeholder_eg + ' ' + elements.inputs.externPort.value;

			state.currentStep = 3;
			updateStepVisibility(elements, state, buttons, wizardData);
			updateDefaultWizardPorts(getActiveProtoValue(elements), portForwardingAlert, elements.inputs.port, elements.inputs.externPort, scenario, wizardData).then(function () {
				triggerWizardNetworkCheck(elements, portForwardingAlert, wizardData, false);
			});
		}
			break;

		case 3: {
			const connType = elements.inputs.connectionType.value;

			if (connType === OPENVPN.CONN_TYPE.IP) {
				elements.inputs.ddns.classList.remove('cbi-input-invalid');
				const inputVal = sanitizeInputLine(elements.inputs.ddns.value);

				if (!inputVal) {
					elements.inputs.ddns.classList.add('cbi-input-invalid');
					elements.inputs.ddns.focus();
					return;
				}

				// Alphanumeric character parsing rule filter maps
				const hasLetters = /[a-zA-Z]/.test(inputVal);

				// If dynamic IP is used without static check, show warning box
				if (!hasLetters && !elements.inputs.isStatic.checked) {
					const warningNode = renderIpValidationWarning(elements, scenario, wizardData, buttons);
					showMessage(warningNode, MESSAGE_TYPE.WARNING, elements.info.messageBox);
					// Blocks execution until user clicks an action button
					buttons.create.disabled = true;
					return;
				}
			}

			if (connType === OPENVPN.CONN_TYPE.DDNS) {
				elements.inputs.ddnsDomain.classList.remove('cbi-input-invalid');
				elements.inputs.ddnsToken.classList.remove('cbi-input-invalid');
				elements.inputs.ddnsUsername.classList.remove('cbi-input-invalid');
				elements.inputs.ddnsCustomUrl.classList.remove('cbi-input-invalid');

				let invalid = false;

				// 1. Check Username field only if it is strictly marked as 'visible'
				const activeProviderOption = elements.inputs.ddnsProvider.options[elements.inputs.ddnsProvider.selectedIndex];
				if (activeProviderOption && activeProviderOption.getAttribute('data-username') === 'visible') {
					if (!sanitizeInputLine(elements.inputs.ddnsUsername.value)) {
						if (elements.inputs.ddnsUsername) {
							// Mark field red
							elements.inputs.ddnsUsername.classList.add('cbi-input-invalid');
							elements.inputs.ddnsUsername.focus();
						}
						invalid = true;
					}
				}

				// 2. Validate Domain Name field
				if (!invalid && !sanitizeInputLine(elements.inputs.ddnsDomain.value)) {
					// Mark field red
					elements.inputs.ddnsDomain.classList.add('cbi-input-invalid');
					elements.inputs.ddnsDomain.focus();
					invalid = true;
				}

				// 3. Validate Token / Password field (only if not a custom URL setup)
				if (!invalid && elements.inputs.ddnsProvider.value !== 'custom') {
					if (!sanitizeInputLine(elements.inputs.ddnsToken.value)) {
						// Mark field red
						elements.inputs.ddnsToken.classList.add('cbi-input-invalid');
						elements.inputs.ddnsToken.focus();
						invalid = true;
					}
				} else if (!invalid) {
					// 4. Validate Custom URL field
					if (!sanitizeInputLine(elements.inputs.ddnsCustomUrl.value)) {
						// Mark field red
						elements.inputs.ddnsCustomUrl.classList.add('cbi-input-invalid');
						elements.inputs.ddnsCustomUrl.focus();
						invalid = true;
					}
				}

				if (invalid) {
					// Stop the wizard from going to the next step or finishing
					return;
				}
			}


			// Final save execution path
			const currentProto = { value: getActiveProtoValue(elements) };
			createServerInstance({ value: scenario }, elements, currentProto, wizardData, buttons.next, buttons.prev);
		}
			break;

		default:
			break;
	}
}

/**
 * Synchronizes the wizard UI elements dynamically when the DDNS provider changes.
 */
const handleDdnsProviderChange = function (selectedOption, elements, buttons) {
	if (!selectedOption) {
		return;
	}

	if (!selectedOption) {
		return;
	}

	lockCreateButton(buttons);

	// 1. Update the domain input field placeholder text dynamically
	const newPlaceholder = selectedOption.getAttribute('data-placeholder') || '';
	if (elements.inputs.ddnsDomain) {
		elements.inputs.ddnsDomain.placeholder = newPlaceholder;
	}

	// 2. Update the helper description line below the provider dropdown
	const descriptionNode = document.getElementById('ddns_provider_description');
	if (descriptionNode) {
		descriptionNode.innerHTML = '';
		const providerText = selectedOption.getAttribute('data-description') || '';
		const providerLink = selectedOption.getAttribute('data-link') || '';
		if (providerLink) {
			const homeLinkAnchor = E('a', { 'href': providerLink, 'target': '_blank', 'rel': 'noopener noreferrer', 'style': 'margin-right: 4px; display: inline-flex; align-items: center; text-decoration: none !important; cursor: pointer; border: none !important;' }, [ICON.GLOBE]);
			descriptionNode.appendChild(homeLinkAnchor);
		}
		descriptionNode.appendChild(document.createTextNode(providerText));
	}

	// 3. Update the left-side label for the token password input field
	const tokenLabelNode = document.getElementById('ddns_token_label');
	if (tokenLabelNode) {
		tokenLabelNode.textContent = selectedOption.getAttribute('data-token-label') || TXT.INFO.token_password;
	}

	// 4. Dynamically rewrite the label of the username row
	const usernameLabelNode = document.getElementById('ddns_username_label');
	if (usernameLabelNode) {
		usernameLabelNode.textContent = selectedOption.getAttribute('data-username-label') || TXT.INFO.username;
	}

	// 5. Dynamic Username visibility control via the custom data-username attribute
	const usernameRow = document.getElementById('ddns_username_container');
	const isUsernameRequired = ((selectedOption.getAttribute('data-username') === 'visible') || (selectedOption.getAttribute('data-username') === 'optional'));

	if (usernameRow) {
		if (isUsernameRequired === true) {
			// show the row safely without breaking the theme layout:
			usernameRow.style.removeProperty('display');
		} else {
			// hide the row completely:
			usernameRow.style.setProperty('display', 'none', 'important');
			if (elements.inputs.ddnsUsername) {
				elements.inputs.ddnsUsername.value = '';
			}
		}
	}
}

/**
 * Binds all change events, click triggers and navigation logic together
 */
const setupWizardEventListeners = function (elements, buttons, portForwardingAlert, wizardData, state) {

	// Update ports and warnings when the protocol changes
	const handleProtoContextChange = function () {
		updateDefaultWizardPorts(getActiveProtoValue(elements), portForwardingAlert, elements.inputs.port, elements.inputs.externPort, getSelectedScenarioValue(elements), wizardData).then(function () {
			triggerWizardNetworkCheck(elements, portForwardingAlert, wizardData, true);
			elements.inputs.port.placeholder = TXT.INFO.placeholder_eg + ' ' + elements.inputs.port.value;
			elements.inputs.externPort.placeholder = TXT.INFO.placeholder_eg + ' ' + elements.inputs.externPort.value;
		});
	}

	// When the user changes a ddns provider clear error color, set placeholder and description text
	// Change placeholder, description, token label, and username visibility on provider change
	elements.inputs.ddnsProvider.addEventListener('change', function () {
		const selectedOption = this.options[this.selectedIndex];
		handleDdnsProviderChange(selectedOption, elements, buttons)
	});

	// Run validation lock and FULL alert re-trigger when the user leaves the public IP/Domain field
	elements.inputs.ddns.addEventListener('blur', function () {
		this.classList.remove('cbi-input-invalid');
		lockCreateButton(buttons);
		triggerWizardNetworkCheck(elements, portForwardingAlert, wizardData, false);
	});

	// Also re-trigger if the user hits "Enter" inside the IP field
	elements.inputs.ddns.addEventListener('keyup', function (ev) {
		if (ev.keyCode === 13) {
			lockCreateButton(buttons);
		}
	});

	// Re-trigger when switching between "Public IP" and "DDNS Service"
	elements.inputs.connectionType.addEventListener('change', function () {
		lockCreateButton(buttons);
		triggerWizardNetworkCheck(elements, portForwardingAlert, wizardData, false);
	});

	// Re-trigger when the DDNS domain input changes
	elements.inputs.ddnsDomain.addEventListener('blur', function () {
		lockCreateButton(buttons);
	});

	elements.radios.udp.addEventListener('change', handleProtoContextChange);
	elements.radios.tcp.addEventListener('change', handleProtoContextChange);

	// Listen to manual internal port modifications
	elements.inputs.port.addEventListener('input', function () {
		lockCreateButton(buttons);
	});

	// Listen to manual external client port modifications to update the alert live
	elements.inputs.externPort.addEventListener('input', function () {
		lockCreateButton(buttons);
	});


	// Update visibility and ports when the VPN type radio changes
	const handleRadioContextChange = function () {
		syncScenarioSubNodeVisibility(elements);
	}

	elements.radios.connectServer.addEventListener('change', handleRadioContextChange);
	elements.radios.siteServer.addEventListener('change', handleRadioContextChange);
	elements.radios.siteClient.addEventListener('change', handleRadioContextChange);

	// Back button click logic
	buttons.prev.addEventListener('click', function () {
		if (state.currentStep > 1) {
			state.currentStep--;
			updateStepVisibility(elements, state, buttons, wizardData);
		}
	});

	buttons.next.addEventListener('click', function () { handleButtonNextClick(state, elements, buttons, portForwardingAlert, wizardData); });
	buttons.create.addEventListener('click', function () { handleButtonNextClick(state, elements, buttons, portForwardingAlert, wizardData); });


	// Close button hiding logic
	buttons.close.addEventListener('click', L.bind(L.ui.hideModal, L.ui));

	// Initialize the default layout states on window load
	syncScenarioSubNodeVisibility(elements);
	updateStepVisibility(elements, state, buttons, wizardData);
};

/**
 * Locks the wizard creation flow by enforcing a mandatory network check.
 */
const lockCreateButton = function (buttons, focus) {
	buttons.check.style.setProperty('display', 'inline-block', 'important');
	buttons.create.style.setProperty('display', 'none', 'important');
	if (focus === true) {
		buttons.check.focus();
	}
};

/**
 * Unlocks the wizard creation flow after a successful network diagnostic.
 */
const unlockCreateButton = function (buttons, focus) {
	buttons.check.style.setProperty('display', 'none', 'important');
	buttons.create.style.setProperty('display', 'inline-block', 'important');
	if (focus === true) {
		buttons.create.focus();
	}
};

/**
 * Sets up the diagnostic event routing for the network address check button.
 */
const setupAddressValidator = function (elements, buttons, portForwardingAlert, wizardData) {

	buttons.check.addEventListener('click', async function (ev) {
		ev.preventDefault();
		const connType = elements.inputs.connectionType.value;
		let targetToTest = '';
		let targetInputField = null;

		// Check if we are using standard IP or Dynamic DNS
		if (connType === OPENVPN.CONN_TYPE.IP) {
			targetToTest = sanitizeInputLine(elements.inputs.ddns.value);
			targetInputField = elements.inputs.ddns;
			if (!targetToTest) {
				if (targetInputField) {
					targetInputField.classList.add('cbi-input-invalid');
					targetInputField.focus();
				}
				return;
			}
			if (targetInputField) targetInputField.classList.remove('cbi-input-invalid');
		} else {
			// --- DDNS MODE VALIDATION ---
			const ddnsDomainField = elements.inputs.ddnsDomain;
			const ddnsTokenField = elements.inputs.ddnsToken;
			const ddnsUserField = elements.inputs.ddnsUsername;
			const rawDomain = sanitizeInputLine(ddnsDomainField.value);
			const rawToken = sanitizeInputLine(ddnsTokenField.value);
			const rawUser = ddnsUserField ? sanitizeInputLine(ddnsUserField.value) : '';

			ddnsDomainField.classList.remove('cbi-input-invalid');
			ddnsTokenField.classList.remove('cbi-input-invalid');
			if (ddnsUserField) ddnsUserField.classList.remove('cbi-input-invalid');

			if (!rawDomain) {
				ddnsDomainField.classList.add('cbi-input-invalid');
				ddnsDomainField.focus();
				return;
			}
			if (!rawToken && elements.inputs.ddnsProvider.value !== 'custom') {
				ddnsTokenField.classList.add('cbi-input-invalid');
				ddnsTokenField.focus();
				return;
			}
			const activeProviderOption = elements.inputs.ddnsProvider.options[elements.inputs.ddnsProvider.selectedIndex];
			if (activeProviderOption && activeProviderOption.getAttribute('data-username') === 'visible') {
				if (!rawUser && ddnsUserField) {
					ddnsUserField.classList.add('cbi-input-invalid');
					ddnsUserField.focus();
					return;
				}
			}
			targetToTest = rawDomain;
			targetInputField = ddnsDomainField;
		}

		if (elements.info.messageBox) {
			elements.info.messageBox.style.setProperty('display', 'none', 'important');
		}

		buttons.check.disabled = true;
		const btn_check_textContent = buttons.check.textContent;
		buttons.check.textContent = ICON.LOADING + TXT.INFO.resolving_target;

		// Start the asynchronous background port scanner immediately
		const activePortCheckPromise = triggerWizardNetworkCheck(elements, portForwardingAlert, wizardData, true);

		// --- START DDNS PROVIDER LOGIN AND UPDATE CHECK ---
		let providerResponse = null;
		let sendingInfoMsg = '';

		try {
			if (connType === OPENVPN.CONN_TYPE.DDNS) {
				const provider = elements.inputs.ddnsProvider.value;
				const domain = sanitizeInputLine(elements.inputs.ddnsDomain.value);
				const token = sanitizeInputLine(elements.inputs.ddnsToken.value);
				let ddnsUser = '';

				if (provider === 'custom') {
					ddnsUser = elements.inputs.ddnsCustomUrl ? sanitizeInputLine(elements.inputs.ddnsCustomUrl.value) : '';
				} else {
					ddnsUser = elements.inputs.ddnsUsername ? sanitizeInputLine(elements.inputs.ddnsUsername.value) : '';
				}

				const updateUrl = await buildDdnsUpdateUrl(provider, domain, token, ddnsUser, wizardData, null);
				if (updateUrl) {
					let displayUrl = updateUrl;
					const tokenField = elements.inputs.ddnsToken;
					if (token && tokenField && tokenField.type === 'password') {
						const maskedStars = '*'.repeat(token.length);
						displayUrl = await buildDdnsUpdateUrl(provider, domain, token, ddnsUser, wizardData, maskedStars);
					}

					sendingInfoMsg = ICON.INFO + ' <strong>DDNS Service:</strong> Sending update URL...<br/>' +
						'<small style="font-family:monospace; opacity:0.7; word-break:break-all;">' + displayUrl + '</small><br/>';
					showMessage(sendingInfoMsg, MESSAGE_TYPE.INFO, elements.info.messageBox);
					providerResponse = await wizardData.networkCallbacks.updateDdnsProvider(updateUrl, domain);
				}
			}

			if (providerResponse && providerResponse.isError) {
				buttons.check.disabled = false;
				buttons.check.textContent = btn_check_textContent;
				if (targetInputField) targetInputField.classList.add('cbi-input-invalid');
				const authErrorMsg = sendingInfoMsg + ICON.ERROR + ' <strong>DDNS Service Error:</strong><br/>' + providerResponse.raw;
				showMessage(authErrorMsg, MESSAGE_TYPE.ERROR, elements.info.messageBox);
				return;
			}

			const providerTextHint = providerResponse ? '<br/><small style="opacity:0.8;">' + providerResponse.raw + '</small>' : '';

			// Start standard DNS lookup and bundle it with the running port checker in parallel
			const activeDdnsCheckPromise = wizardData.networkCallbacks.checkDdns(targetToTest);
			const results = await Promise.all([activeDdnsCheckPromise, activePortCheckPromise]);
			const res = results[0];

			buttons.check.disabled = false;
			buttons.check.textContent = btn_check_textContent;

			if (res && res.success === true) {
				let successMsg = sendingInfoMsg + ICON.CHECK + TXT.MSG.ip_valid_and_resolvable + providerTextHint + '<br/>' + ICON.GLOBE;
				const hasLetters = /[a-zA-Z]/.test(targetToTest);
				if ((connType === OPENVPN.CONN_TYPE.DDNS) || (hasLetters)) {
					successMsg += targetToTest + ' ';
				}
				successMsg += '(' + res.response + ')';
				showMessage(successMsg, MESSAGE_TYPE.OK, elements.info.messageBox);
				unlockCreateButton(buttons);
			} else {
				if (targetInputField) targetInputField.classList.add('cbi-input-invalid');
				const errorBox = E('div', {}, [
					E('p', {}, TXT.WARNING.ip_cannot_be_resolved),
					E('button', {
						'class': 'cbi-button cbi-button-remove',
						'style': 'margin-top:8px; font-weight:bold;',
						'click': function (clickEv) {
							clickEv.preventDefault();
							unlockCreateButton(buttons);
							showMessage(ICON.INFO + TXT.MSG.ip_validation_bypassed_by_admin, MESSAGE_TYPE.INFO, elements.info.messageBox);
						}
					}, TXT.MSG.skip_check_unlock_create)
				]);
				showMessage(errorBox, MESSAGE_TYPE.ERROR, elements.info.messageBox);
			}
		} catch {
			buttons.check.disabled = false;
			buttons.check.textContent = btn_check_textContent;
			if (targetInputField) targetInputField.classList.add('cbi-input-invalid');
			const nativeErrorBox = E('div', {}, [
				E('p', {}, TXT.ERROR.dns_ip_check_failed),
				E('button', {
					'class': 'cbi-button cbi-button-remove',
					'style': 'margin-top:8px; font-weight:bold;',
					'click': function (clickEv) {
						clickEv.preventDefault();
						unlockCreateButton(buttons);
						showMessage(ICON.INFO + TXT.MSG.ip_validation_bypassed_after_net_failure, MESSAGE_TYPE.INFO, elements.info.messageBox);
					}
				}, TXT.MSG.skip_check_unlock_create)
			]);
			showMessage(nativeErrorBox, MESSAGE_TYPE.ERROR, elements.info.messageBox);
		}
	});
};


/**
 * MAIN WIZARD
 */
const openWizardModal = function (wizardData, optionalHideClient) {

	// Instantiate the new independent port forwarding warning component
	const portForwardingAlert = renderPortForwardingAlert(wizardData.networkCallbacks);
	const selectedScenario = wizardData.forcedScenario || OPENVPN.SCENARIO.CONNECT_SERVER;

	// Create all text boxes, buttons, and radio controls
	const buttons = createWizardNavigationButtons();
	const elements = createWizardInputElements(buttons, wizardData, selectedScenario, portForwardingAlert, optionalHideClient);

	// Create the description text line that changes on every step
	const descrNode = E('div', {
		'class': 'cbi-section-descr',
		'style': 'margin-bottom:15px; border-bottom:1px solid var(--border-color-medium, #cbd5e1); padding-bottom:8px; font-weight:bold;color:color-mix(in srgb, var(--text-color-medium, #71717a) 85%, #0055ff);'
	}, [TXT.MSG.create_vpn_few_clicks]);

	// Put all steps and rows into a single state map
	const state = {
		currentStep: wizardData.forcedScenario ? 2 : 1,
		nodes: { descr: descrNode },
		rows: {
			step1: buildWizardStep1Row(elements.inputs.displayName, elements.radios.connectServer, elements.radios.siteServer, elements.radios.siteClient, optionalHideClient),
			step2: buildWizardStep2Row(elements.subNodes.connectServer.node, elements.subNodes.siteServer.node, elements.subNodes.siteClient.node),
			step3: buildWizardStep3Row(elements.inputs, elements.radios.udp, elements.radios.tcp, buttons, portForwardingAlert.node)
		}
	};

	// Execute the decoupled external address check validator logic routine
	setupAddressValidator(elements, buttons, portForwardingAlert, wizardData);

	// Connect core multi-step page transition handler
	setupWizardEventListeners(elements, buttons, portForwardingAlert, wizardData, state);

	// Try to find your public IP address automatically in the background
	if (typeof wizardData.networkCallbacks.getDdnsOrPublicIp === 'function') {
		elements.inputs.ddns.value = TXT.MSG.finding_your_public_ip;
		wizardData.networkCallbacks.getDdnsOrPublicIp().then(function (detectedAddress) {
			elements.inputs.ddns.value = detectedAddress;
		});
	} else {
		elements.inputs.ddns.value = window.location.hostname;
	}

	// Inject custom modal styles into the document head if not already present
	if (!document.getElementById('ovpn-plus-wizard-styles')) {
		const styleNode = E('style', { 'id': 'ovpn-plus-wizard-styles' },
			'.modal.ovpn-plus-wizard-modal { width: 90%; min-width: 270px; max-width: 900px; }'
		);
		document.head.appendChild(styleNode);
	}

	// Show the modal window on the screen with a simple layout structure
	L.ui.showModal(ICON.ROCKET + TXT.INFO.setup_wizard, [
		E('div', {
			'class': 'cbi-map ovpn-plus-setup-wizard',
			'style': 'width: 100%; margin: 0 auto;'
		}, [
			E('div', { 'class': 'cbi-section' }, [
				state.nodes.descr,

				state.rows.step1,
				state.rows.step2,
				state.rows.step3,
				E('div', { 'style': 'text-align:right; margin-top:20px; border-top:1px solid var(--border-color-medium, #cbd5e1); padding-top:12px;' }, [
					elements.info.messageBox,
					buttons.prev,
					buttons.next,
					buttons.check,
					buttons.create,
					buttons.close
				])
			])
		])
	], 'ovpn-plus-wizard-modal');
};

/**
 * Export the open wizard modal function to LuCI
 */
return L.Class.extend(
	{
		WIZARD_DATA_TEMPLATE: WIZARD_DATA_TEMPLATE,
		WIZARD_PARAMS_TEMPLATE: WIZARD_PARAMS_TEMPLATE,
		renderSubnetInputs: renderSubnetInputs,
		renderPortForwardingAlert: renderPortForwardingAlert,
		getValidCommonName: getValidCommonName,
		openWizardModal: openWizardModal
	});
