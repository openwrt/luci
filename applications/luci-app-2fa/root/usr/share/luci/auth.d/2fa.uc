// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026 LuCI 2FA Plugin Contributors
//
// LuCI Authentication Plugin: Two-Factor Authentication (2FA/OTP)
//
// This plugin implements TOTP/HOTP verification as an additional
// authentication factor for LuCI login.

// Default minimum valid time (2026-01-01 00:00:00 UTC)
// TOTP depends on accurate system time. If system clock is not calibrated
// (e.g., after power loss on devices without RTC battery), TOTP codes will
// be incorrect and users will be locked out. This threshold disables TOTP
// when system time appears uncalibrated.
const DEFAULT_MIN_VALID_TIME = 1767225600;

// Check if system time is calibrated (not earlier than minimum valid time)
function check_time_calibration() {
	let uci = require('uci');
	let ctx = uci.cursor();
	let config_time = ctx.get('2fa', 'settings', 'min_valid_time');
	let min_valid_time = config_time ? int(config_time) : DEFAULT_MIN_VALID_TIME;
	let current_time = time();
	
	return {
		calibrated: current_time >= min_valid_time,
		current_time: current_time,
		min_valid_time: min_valid_time
	};
}

// Constant-time string comparison to prevent timing attacks
function constant_time_compare(a, b) {
	if (length(a) != length(b))
		return false;

	let result = 0;
	for (let i = 0; i < length(a); i++) {
		result = result | (ord(a, i) ^ ord(b, i));
	}
	return result == 0;
}

// Sanitize username to prevent command injection
function sanitize_username(username) {
	if (!match(username, /^[a-zA-Z0-9_.+-]+$/))
		return null;
	return username;
}

// Validate IP address (IPv4 or IPv6)
// Note: IPv6 validation is simplified - it accepts basic IPv6 formats but may allow some invalid addresses.
function is_valid_ip(ip) {
	if (!ip || ip == '')
		return false;
	// IPv4 pattern - validate each octet is 0-255
	if (match(ip, /^(\d{1,3}\.){3}\d{1,3}$/)) {
		let parts = split(ip, '.');
		for (let i = 0; i < length(parts); i++) {
			if (int(parts[i]) > 255) return false;
		}
		return true;
	}
	// IPv4 CIDR pattern
	if (match(ip, /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/)) {
		let cidr_parts = split(ip, '/');
		let prefix = int(cidr_parts[1]);
		if (prefix < 0 || prefix > 32) return false;
		let ip_parts = split(cidr_parts[0], '.');
		for (let i = 0; i < length(ip_parts); i++) {
			if (int(ip_parts[i]) > 255) return false;
		}
		return true;
	}
	// IPv6 pattern (simplified - basic validation)
	if (match(ip, /^[0-9a-fA-F:]+$/) && index(ip, ':') >= 0)
		return true;
	// IPv6 CIDR pattern
	if (match(ip, /^[0-9a-fA-F:]+\/\d{1,3}$/) && index(ip, ':') >= 0) {
		let cidr_parts = split(ip, '/');
		let prefix = int(cidr_parts[1]);
		if (prefix < 0 || prefix > 128) return false;
		return true;
	}
	return false;
}

// Check if an IP is in a CIDR range
// Note: For IPv6, CIDR matching falls back to exact string comparison.
function ip_in_cidr(ip, cidr) {
	// Split CIDR into IP and prefix
	let parts = split(cidr, '/');
	let network_ip = parts[0];
	let prefix = (length(parts) > 1) ? int(parts[1]) : 32;
	
	// For IPv6, fall back to exact string comparison (limited support)
	if (!match(ip, /^(\d{1,3}\.){3}\d{1,3}$/))
		return ip == network_ip;
	
	if (!match(network_ip, /^(\d{1,3}\.){3}\d{1,3}$/))
		return false;
	
	let ip_parts = split(ip, '.');
	let net_parts = split(network_ip, '.');
	
	let ip_int = (int(ip_parts[0]) << 24) | (int(ip_parts[1]) << 16) | (int(ip_parts[2]) << 8) | int(ip_parts[3]);
	let net_int = (int(net_parts[0]) << 24) | (int(net_parts[1]) << 16) | (int(net_parts[2]) << 8) | int(net_parts[3]);
	
	// Create network mask
	let mask = 0;
	if (prefix > 0) {
		mask = (0xFFFFFFFF << (32 - prefix)) & 0xFFFFFFFF;
	}
	
	return ((ip_int & mask) == (net_int & mask));
}

// Check if IP is in whitelist
function is_ip_whitelisted(ip) {
	let uci = require('uci');
	let ctx = uci.cursor();
	
	// Check if IP whitelist is enabled
	let whitelist_enabled = ctx.get('2fa', 'settings', 'ip_whitelist_enabled');
	if (whitelist_enabled != '1')
		return false;
	
	// Get whitelist
	let settings = ctx.get_all('2fa', 'settings');
	if (!settings || !settings.ip_whitelist)
		return false;
	
	let ips = settings.ip_whitelist;
	if (type(ips) == 'string') {
		ips = [ips];
	}
	
	for (let entry in ips) {
		if (!entry || entry == '')
			continue;
		// Check if it's a CIDR range or exact match
		if (index(entry, '/') >= 0) {
			if (ip_in_cidr(ip, entry))
				return true;
		} else {
			if (ip == entry)
				return true;
		}
	}
	
	return false;
}

// Get all LAN interface subnets from OpenWrt network configuration
// Returns array of CIDR strings (e.g., ["192.168.1.0/24", "10.0.0.0/24"])
function get_lan_subnets() {
	let fs = require('fs');
	let uci = require('uci');
	let subnets = [];
	
	// Method 1: Try ubus call to get LAN interface status (most accurate, includes DHCP-assigned IPs)
	let fd = fs.popen('ubus call network.interface.lan status 2>/dev/null', 'r');
	if (fd) {
		let output = fd.read('all');
		fd.close();
		
		if (output) {
			let status = json(output);
			if (status && status['ipv4-address']) {
				for (let addr in status['ipv4-address']) {
					if (addr.address && addr.mask) {
						// Convert mask (e.g., 24) and address to network CIDR
						let ip_parts = split(addr.address, '.');
						if (length(ip_parts) == 4) {
							let mask = int(addr.mask);
							// Calculate network address
							let ip_int = (int(ip_parts[0]) << 24) | (int(ip_parts[1]) << 16) | (int(ip_parts[2]) << 8) | int(ip_parts[3]);
							let net_mask = (0xFFFFFFFF << (32 - mask)) & 0xFFFFFFFF;
							let net_int = ip_int & net_mask;
							let net_addr = sprintf('%d.%d.%d.%d', 
								(net_int >> 24) & 0xFF,
								(net_int >> 16) & 0xFF,
								(net_int >> 8) & 0xFF,
								net_int & 0xFF);
							push(subnets, net_addr + '/' + mask);
						}
					}
				}
			}
		}
	}
	
	// Method 2: Fallback to UCI network config if ubus failed
	if (length(subnets) == 0) {
		let ctx = uci.cursor();
		
		// Get LAN interface configuration
		let lan_ipaddr = ctx.get('network', 'lan', 'ipaddr');
		let lan_netmask = ctx.get('network', 'lan', 'netmask');
		
		if (lan_ipaddr && lan_netmask) {
			// Convert netmask to CIDR prefix
			let mask_parts = split(lan_netmask, '.');
			if (length(mask_parts) == 4) {
				let mask_int = (int(mask_parts[0]) << 24) | (int(mask_parts[1]) << 16) | (int(mask_parts[2]) << 8) | int(mask_parts[3]);
				let prefix = 0;
				for (let i = 31; i >= 0; i--) {
					if ((mask_int >> i) & 1) prefix++;
					else break;
				}
				
				// Calculate network address
				let ip_parts = split(lan_ipaddr, '.');
				if (length(ip_parts) == 4) {
					let ip_int = (int(ip_parts[0]) << 24) | (int(ip_parts[1]) << 16) | (int(ip_parts[2]) << 8) | int(ip_parts[3]);
					let net_int = ip_int & mask_int;
					let net_addr = sprintf('%d.%d.%d.%d',
						(net_int >> 24) & 0xFF,
						(net_int >> 16) & 0xFF,
						(net_int >> 8) & 0xFF,
						net_int & 0xFF);
					push(subnets, net_addr + '/' + prefix);
				}
			}
		}
	}
	
	return subnets;
}

// Check if IP is in a LAN subnet (dynamically detected from OpenWrt network config)
// Used for strict mode when system time is not calibrated
function is_local_subnet(ip) {
	if (!ip || ip == '')
		return false;
	
	// Only check IPv4 addresses
	if (!match(ip, /^(\d{1,3}\.){3}\d{1,3}$/))
		return false;
	
	// Get LAN subnets from OpenWrt configuration
	let lan_subnets = get_lan_subnets();
	
	// Check if IP is in any of the LAN subnets
	for (let subnet in lan_subnets) {
		if (ip_in_cidr(ip, subnet))
			return true;
	}
	
	return false;
}

// Rate limit state file
const RATE_LIMIT_FILE = '/tmp/2fa_rate_limit.json';

// Load rate limit state
function load_rate_limit_state() {
	let fs = require('fs');
	let content = fs.readfile(RATE_LIMIT_FILE);
	if (!content)
		return {};
	
	let state = json(content);
	if (!state)
		return {};
	
	return state;
}

// Save rate limit state
function save_rate_limit_state(state) {
	let fs = require('fs');
	fs.writefile(RATE_LIMIT_FILE, sprintf('%J', state));
}

// Check rate limit
function check_rate_limit(ip) {
	let uci = require('uci');
	let ctx = uci.cursor();
	
	// Check if rate limiting is enabled
	let rate_limit_enabled = ctx.get('2fa', 'settings', 'rate_limit_enabled');
	if (rate_limit_enabled != '1')
		return { allowed: true, remaining: -1, locked_until: 0 };
	
	let max_attempts = int(ctx.get('2fa', 'settings', 'rate_limit_max_attempts') || '5');
	let window = int(ctx.get('2fa', 'settings', 'rate_limit_window') || '60');
	let lockout = int(ctx.get('2fa', 'settings', 'rate_limit_lockout') || '300');
	
	let now = time();
	let state = load_rate_limit_state();
	
	if (!state[ip]) {
		state[ip] = { attempts: [], locked_until: 0 };
	}
	
	let ip_state = state[ip];
	
	// Check if IP is locked out
	if (ip_state.locked_until > now) {
		return { allowed: false, remaining: 0, locked_until: ip_state.locked_until };
	}
	
	// Clean old attempts outside the window
	let recent_attempts = [];
	for (let attempt in ip_state.attempts) {
		if (attempt > (now - window)) {
			push(recent_attempts, attempt);
		}
	}
	ip_state.attempts = recent_attempts;
	
	// Check if within rate limit
	let remaining = max_attempts - length(ip_state.attempts);
	if (remaining <= 0) {
		// Lock out the IP
		ip_state.locked_until = now + lockout;
		ip_state.attempts = [];  // Reset attempts after lockout
		save_rate_limit_state(state);
		return { allowed: false, remaining: 0, locked_until: ip_state.locked_until };
	}
	
	save_rate_limit_state(state);
	return { allowed: true, remaining: remaining, locked_until: 0 };
}

// Record a failed login attempt
function record_failed_attempt(ip) {
	let uci = require('uci');
	let ctx = uci.cursor();
	
	// Check if rate limiting is enabled
	let rate_limit_enabled = ctx.get('2fa', 'settings', 'rate_limit_enabled');
	if (rate_limit_enabled != '1')
		return;
	
	let now = time();
	let state = load_rate_limit_state();
	
	if (!state[ip]) {
		state[ip] = { attempts: [], locked_until: 0 };
	}
	
	push(state[ip].attempts, now);
	save_rate_limit_state(state);
}

// Clear rate limit for an IP (on successful login)
function clear_rate_limit(ip) {
	let state = load_rate_limit_state();
	if (state[ip]) {
		delete state[ip];
		save_rate_limit_state(state);
	}
}

// Check if 2FA is enabled for a user
function is_2fa_enabled(username) {
	let uci = require('uci');
	let ctx = uci.cursor();
	
	// Check if 2FA is globally enabled
	let enabled = ctx.get('2fa', 'settings', 'enabled');
	if (enabled != '1')
		return false;

	// Sanitize username
	let safe_username = sanitize_username(username);
	if (!safe_username)
		return false;

	// Check if user has a key configured
	let key = ctx.get('2fa', safe_username, 'key');
	if (!key || key == '')
		return false;

	return true;
}

// Verify OTP for user
// Returns: { success: bool }
function verify_otp(username, otp) {
	let fs = require('fs');
	let uci = require('uci');
	let ctx = uci.cursor();
	
	if (!otp || otp == '')
		return { success: false };

	let safe_username = sanitize_username(username);
	if (!safe_username)
		return { success: false };

	// Trim and normalize input
	otp = trim(otp);
	
	// Validate OTP format: must be exactly 6 digits
	if (!match(otp, /^[0-9]{6}$/))
		return { success: false };

	// Get OTP type to determine verification strategy
	let otp_type = ctx.get('2fa', safe_username, 'type') || 'totp';

	// SECURITY: We use string form of popen() because the array form doesn't
	// work in current ucode versions on OpenWrt. Shell injection is prevented by:
	// 1. sanitize_username() above returns null for any input not matching [a-zA-Z0-9_.+-]
	// 2. We only proceed if safe_username is not null (sanitization passed)
	// 3. The character set [a-zA-Z0-9_.+-] cannot form shell metacharacters

	if (otp_type == 'hotp') {
		// HOTP verification: use --no-increment to not consume the counter during verification
		// SECURITY: safe_username is validated by sanitize_username() to match [a-zA-Z0-9_.+-]+
		let fd = fs.popen('/usr/libexec/generate_otp.uc ' + safe_username + ' --no-increment', 'r');
		if (!fd)
			return { success: false };

		let expected_otp = fd.read('all');
		fd.close();
		expected_otp = trim(expected_otp);
		
		if (!match(expected_otp, /^[0-9]{6}$/))
			return { success: false };

		if (constant_time_compare(expected_otp, otp)) {
			// OTP matches, now increment the counter for HOTP
			let counter = int(ctx.get('2fa', safe_username, 'counter') || '0');
			ctx.set('2fa', safe_username, 'counter', '' + (counter + 1));
			ctx.commit('2fa');
			return { success: true };
		}
		return { success: false };
	} else {
		// TOTP verification: check current window and adjacent windows (±1) for time drift tolerance
		let step = int(ctx.get('2fa', safe_username, 'step') || '30');
		if (step <= 0) step = 30;  // Ensure valid step value
		let current_time = time();
		
		// Check window offsets: current (0), previous (-1), next (+1)
		// SECURITY: check_time is derived from time() (integer) and integer arithmetic only
		// safe_username is validated by sanitize_username() to match [a-zA-Z0-9_.+-]+
		for (let offset in [0, -1, 1]) {
			let check_time = int(current_time + (offset * step));  // Explicit int conversion
			let fd = fs.popen('/usr/libexec/generate_otp.uc ' + safe_username + ' --no-increment --time=' + check_time, 'r');
			if (!fd)
				continue;

			let expected_otp = fd.read('all');
			fd.close();
			expected_otp = trim(expected_otp);
			
			if (!match(expected_otp, /^[0-9]{6}$/))
				continue;

			if (constant_time_compare(expected_otp, otp)) {
				return { success: true };
			}
		}
		return { success: false };
	}
}

// Get client IP from HTTP request
// SECURITY NOTE: X-Forwarded-For header can be spoofed by clients.
// This is acceptable for rate limiting (worst case: attacker can only bypass their own rate limit)
// but should not be used for security-critical IP-based authorization.
// For trusted proxy setups, consider implementing a trusted proxy IP list in the future.
function get_client_ip(http) {
	// Try to get client IP from various sources
	let ip = null;
	
	if (http && http.getenv) {
		// Prefer REMOTE_ADDR as it's more reliable (cannot be spoofed without proxy)
		ip = http.getenv('REMOTE_ADDR');
		
		// Only use X-Forwarded-For if REMOTE_ADDR is a loopback/local address
		// This provides basic protection against header spoofing
		if (ip && (ip == '127.0.0.1' || ip == '::1')) {
			let xff = http.getenv('HTTP_X_FORWARDED_FOR');
			if (xff) {
				// X-Forwarded-For may contain multiple IPs, get the first one
				let parts = split(xff, ',');
				ip = trim(parts[0]);
			}
		}
	}
	
	return ip || '';
}

return {
	// Plugin identifier
	name: '2fa',
	
	// Priority (lower = executed first)
	priority: 10,

	/**
	 * Check if this plugin requires additional authentication
	 * 
	 * @param http - HTTP request object
	 * @param user - Username being authenticated
	 * @returns Object with:
	 *   - required: bool - true if 2FA verification is needed
	 *   - fields: array - Form fields to add to sysauth template
	 *   - message: string - Message to display
	 */
	check: function(http, user) {
		let client_ip = get_client_ip(http);
		
		// Check if IP is whitelisted (bypass 2FA)
		if (client_ip && is_ip_whitelisted(client_ip)) {
			return { required: false, whitelisted: true };
		}
		
		// Check rate limit
		if (client_ip) {
			let rate_check = check_rate_limit(client_ip);
			if (!rate_check.allowed) {
				let remaining_seconds = rate_check.locked_until - time();
				return {
					required: true,
					blocked: true,
					message: sprintf('Too many failed attempts. Please try again in %d seconds.', remaining_seconds),
					fields: []
				};
			}
		}
		
		if (!is_2fa_enabled(user)) {
			return { required: false };
		}

		// Check time calibration for TOTP
		let uci = require('uci');
		let ctx = uci.cursor();
		let safe_username = sanitize_username(user);
		let otp_type = ctx.get('2fa', safe_username, 'type') || 'totp';
		
		if (otp_type == 'totp') {
			let time_check = check_time_calibration();
			if (!time_check.calibrated) {
				// Time not calibrated - check strict mode setting
				let strict_mode = ctx.get('2fa', 'settings', 'strict_mode');
				
				if (strict_mode == '1') {
					// Strict mode enabled: block non-LAN subnets, bypass 2FA for LAN subnets
					if (client_ip && is_local_subnet(client_ip)) {
						// LAN subnet - bypass 2FA
						return { required: false, time_not_calibrated: true, local_subnet_bypass: true };
					} else {
						// Not LAN subnet - block login completely
						return {
							required: true,
							blocked: true,
							message: 'System time is not calibrated (before 2026). Login is blocked for security. Please access from LAN interface or sync system time.',
							fields: []
						};
					}
				} else {
					// Non-strict mode: skip 2FA completely to prevent lockout (same as before)
					return { required: false, time_not_calibrated: true };
				}
			}
		}

		return {
			required: true,
			fields: [
				{
					name: 'luci_otp',
					type: 'text',
					label: 'One-Time Password',
					placeholder: '123456',
					inputmode: 'numeric',
					pattern: '[0-9]*',
					maxlength: 6,
					autocomplete: 'one-time-code',
					required: true
				}
			],
			message: 'Please enter your one-time password from your authenticator app.'
		};
	},

	/**
	 * Verify the additional authentication
	 * 
	 * @param http - HTTP request object
	 * @param user - Username being authenticated
	 * @returns Object with:
	 *   - success: bool - true if verification succeeded
	 *   - message: string - Error message if failed
	 */
	verify: function(http, user) {
		let client_ip = get_client_ip(http);
		
		// Check if IP is whitelisted (bypass 2FA)
		if (client_ip && is_ip_whitelisted(client_ip)) {
			return { success: true, whitelisted: true };
		}
		
		// Check rate limit
		if (client_ip) {
			let rate_check = check_rate_limit(client_ip);
			if (!rate_check.allowed) {
				let remaining_seconds = rate_check.locked_until - time();
				return {
					success: false,
					rate_limited: true,
					message: sprintf('Too many failed attempts. Please try again in %d seconds.', remaining_seconds)
				};
			}
		}
		
		let otp = http.formvalue('luci_otp');
		
		// Trim input immediately for consistent validation
		if (otp)
			otp = trim(otp);
		
		if (!otp || otp == '') {
			if (client_ip) record_failed_attempt(client_ip);
			return {
				success: false,
				message: 'Please enter your one-time password.'
			};
		}

		let verify_result = verify_otp(user, otp);
		
		if (!verify_result.success) {
			if (client_ip) record_failed_attempt(client_ip);
			
			return {
				success: false,
				message: 'Invalid one-time password. Please try again.'
			};
		}

		// Clear rate limit on successful login
		if (client_ip) clear_rate_limit(client_ip);
		
		return { success: true };
	}
};
