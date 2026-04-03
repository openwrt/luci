// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026 LuCI 2FA Plugin Contributors
//
// LuCI Authentication Plugin: Two-Factor Authentication (2FA/OTP)
//
// This plugin implements TOTP/HOTP verification as an additional
// authentication factor for LuCI login.
//
// Adapted for master's plugin architecture (luci_plugins UCI config)

'use strict';

import { popen, readfile, writefile } from 'fs';
import { cursor } from 'uci';

const PLUGIN_UUID = 'bb4ea47fcffb44ec9bb3d3673c9b4ed2';

// Default minimum valid time (2026-01-01 00:00:00 UTC)
// TOTP depends on accurate system time. If system clock is not calibrated
// (e.g., after power loss on devices without RTC battery), TOTP codes will
// be incorrect and users will be locked out. This threshold disables TOTP
// when system time appears uncalibrated.
const DEFAULT_MIN_VALID_TIME = 1767225600;

// Rate limit state file
const RATE_LIMIT_FILE = '/tmp/2fa_rate_limit.json';
const RATE_LIMIT_LOCK_FILE = '/tmp/2fa_rate_limit.lock';
const DEFAULT_PRIORITY = 15;

function get_priority() {
	let ctx = cursor();
	let value = ctx.get('luci_plugins', PLUGIN_UUID, 'priority');

	if (!value || !match(value, /^-?[0-9]+$/))
		return DEFAULT_PRIORITY;

	return int(value);
}

// Check if system time is calibrated (not earlier than minimum valid time)
function check_time_calibration() {
	let ctx = cursor();
	let config_time = ctx.get('luci_plugins', PLUGIN_UUID, 'min_valid_time');
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
	// IPv6 pattern (simplified)
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
function ip_in_cidr(ip, cidr) {
	let parts = split(cidr, '/');
	let network_ip = parts[0];
	let prefix = (length(parts) > 1) ? int(parts[1]) : 32;
	
	// For IPv6, fall back to exact string comparison
	if (!match(ip, /^(\d{1,3}\.){3}\d{1,3}$/))
		return ip == network_ip;
	
	if (!match(network_ip, /^(\d{1,3}\.){3}\d{1,3}$/))
		return false;
	
	let ip_parts = split(ip, '.');
	let net_parts = split(network_ip, '.');
	
	let ip_int = (int(ip_parts[0]) << 24) | (int(ip_parts[1]) << 16) | (int(ip_parts[2]) << 8) | int(ip_parts[3]);
	let net_int = (int(net_parts[0]) << 24) | (int(net_parts[1]) << 16) | (int(net_parts[2]) << 8) | int(net_parts[3]);
	
	let mask = 0;
	if (prefix > 0) {
		mask = (0xFFFFFFFF << (32 - prefix)) & 0xFFFFFFFF;
	}
	
	return ((ip_int & mask) == (net_int & mask));
}

// Check if IP is in whitelist
function is_ip_whitelisted(ip) {
	let ctx = cursor();
	
	let whitelist_enabled = ctx.get('luci_plugins', PLUGIN_UUID, 'ip_whitelist_enabled');
	if (whitelist_enabled != '1')
		return false;
	
	let settings = ctx.get_all('luci_plugins', PLUGIN_UUID);
	if (!settings || !settings.ip_whitelist)
		return false;
	
	let ips = settings.ip_whitelist;
	if (type(ips) == 'string') {
		// Split space-separated string into array
		ips = split(trim(ips), /\s+/);
	}
	
	for (let entry in ips) {
		if (!entry || entry == '')
			continue;
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
function get_lan_subnets() {
	let subnets = [];
	
	// Try ubus call to get LAN interface status
	let fd = popen('ubus call network.interface.lan status 2>/dev/null', 'r');
	if (fd) {
		let output = fd.read('all');
		fd.close();
		
		if (output) {
			let status = json(output);
			if (status && status['ipv4-address']) {
				for (let addr in status['ipv4-address']) {
					if (addr.address && addr.mask) {
						let ip_parts = split(addr.address, '.');
						if (length(ip_parts) == 4) {
							let mask = int(addr.mask);
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
	
	// Fallback to UCI network config
	if (length(subnets) == 0) {
		let ctx = cursor();
		let lan_ipaddr = ctx.get('network', 'lan', 'ipaddr');
		let lan_netmask = ctx.get('network', 'lan', 'netmask');
		
		if (lan_ipaddr && lan_netmask) {
			let mask_parts = split(lan_netmask, '.');
			if (length(mask_parts) == 4) {
				let mask_int = (int(mask_parts[0]) << 24) | (int(mask_parts[1]) << 16) | (int(mask_parts[2]) << 8) | int(mask_parts[3]);
				let prefix = 0;
				for (let i = 31; i >= 0; i--) {
					if ((mask_int >> i) & 1) prefix++;
					else break;
				}
				
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

// Check if IP is in a LAN subnet
function is_local_subnet(ip) {
	if (!ip || ip == '')
		return false;
	
	if (!match(ip, /^(\d{1,3}\.){3}\d{1,3}$/))
		return false;
	
	let lan_subnets = get_lan_subnets();
	
	for (let subnet in lan_subnets) {
		if (ip_in_cidr(ip, subnet))
			return true;
	}
	
	return false;
}

// Load rate limit state
function load_rate_limit_state() {
	let content = readfile(RATE_LIMIT_FILE);
	if (!content)
		return {};
	
	let state = json(content);
	if (!state)
		return {};
	
	return state;
}

// Save rate limit state
function save_rate_limit_state(state) {
	writefile(RATE_LIMIT_FILE, sprintf('%J', state));
}

function lock_rate_limit_state() {
	let fd = popen('lock -w 5 ' + RATE_LIMIT_LOCK_FILE + ' >/dev/null 2>&1; echo $?', 'r');
	if (!fd)
		return false;

	let status = trim(fd.read('all') || '');
	fd.close();

	return status == '0';
}

function unlock_rate_limit_state() {
	let fd = popen('lock -u ' + RATE_LIMIT_LOCK_FILE + ' >/dev/null 2>&1', 'r');
	if (fd)
		fd.close();
}

// Check rate limit
function check_rate_limit(ip) {
	let ctx = cursor();
	
	let rate_limit_enabled = ctx.get('luci_plugins', PLUGIN_UUID, 'rate_limit_enabled');
	if (rate_limit_enabled != '1')
		return { allowed: true, remaining: -1, locked_until: 0 };

	if (!lock_rate_limit_state())
		return { allowed: false, remaining: 0, locked_until: time() + 5 };
	
	let max_attempts = int(ctx.get('luci_plugins', PLUGIN_UUID, 'rate_limit_max_attempts') || '5');
	let window = int(ctx.get('luci_plugins', PLUGIN_UUID, 'rate_limit_window') || '60');
	let lockout = int(ctx.get('luci_plugins', PLUGIN_UUID, 'rate_limit_lockout') || '300');
	
	let now = time();
	let state = load_rate_limit_state();
	let result;
	
	if (!state[ip]) {
		state[ip] = { attempts: [], locked_until: 0 };
	}
	
	let ip_state = state[ip];
	
	if (ip_state.locked_until > now) {
		result = { allowed: false, remaining: 0, locked_until: ip_state.locked_until };
		unlock_rate_limit_state();
		return result;
	}
	
	let recent_attempts = [];
	for (let attempt in ip_state.attempts) {
		if (attempt > (now - window)) {
			push(recent_attempts, attempt);
		}
	}
	ip_state.attempts = recent_attempts;
	
	let remaining = max_attempts - length(ip_state.attempts);
	if (remaining <= 0) {
		ip_state.locked_until = now + lockout;
		ip_state.attempts = [];
		save_rate_limit_state(state);
		result = { allowed: false, remaining: 0, locked_until: ip_state.locked_until };
		unlock_rate_limit_state();
		return result;
	}
	
	save_rate_limit_state(state);
	result = { allowed: true, remaining: remaining, locked_until: 0 };
	unlock_rate_limit_state();
	return result;
}

// Reserve a rate-limit attempt atomically before verification
function consume_rate_limit_attempt(ip) {
	let ctx = cursor();
	
	let rate_limit_enabled = ctx.get('luci_plugins', PLUGIN_UUID, 'rate_limit_enabled');
	if (rate_limit_enabled != '1')
		return { allowed: true, remaining: -1, locked_until: 0 };

	if (!lock_rate_limit_state())
		return { allowed: false, remaining: 0, locked_until: time() + 5 };

	let max_attempts = int(ctx.get('luci_plugins', PLUGIN_UUID, 'rate_limit_max_attempts') || '5');
	let window = int(ctx.get('luci_plugins', PLUGIN_UUID, 'rate_limit_window') || '60');
	let lockout = int(ctx.get('luci_plugins', PLUGIN_UUID, 'rate_limit_lockout') || '300');
	
	let now = time();
	let state = load_rate_limit_state();
	let result;
	
	if (!state[ip]) {
		state[ip] = { attempts: [], locked_until: 0 };
	}

	let ip_state = state[ip];

	if (ip_state.locked_until > now) {
		result = { allowed: false, remaining: 0, locked_until: ip_state.locked_until };
		unlock_rate_limit_state();
		return result;
	}

	let recent_attempts = [];
	for (let attempt in ip_state.attempts) {
		if (attempt > (now - window))
			push(recent_attempts, attempt);
	}
	ip_state.attempts = recent_attempts;

	if (length(ip_state.attempts) >= max_attempts) {
		ip_state.locked_until = now + lockout;
		ip_state.attempts = [];
		save_rate_limit_state(state);
		result = { allowed: false, remaining: 0, locked_until: ip_state.locked_until };
		unlock_rate_limit_state();
		return result;
	}

	push(ip_state.attempts, now);
	save_rate_limit_state(state);
	result = { allowed: true, remaining: max_attempts - length(ip_state.attempts), locked_until: 0 };
	unlock_rate_limit_state();
	return result;
}

// Clear rate limit for an IP
function clear_rate_limit(ip) {
	if (!lock_rate_limit_state())
		return;

	let state = load_rate_limit_state();
	if (state[ip]) {
		delete state[ip];
		save_rate_limit_state(state);
	}

	unlock_rate_limit_state();
}

// Check if 2FA is enabled for a user
// Configuration keys: key_<username>, type_<username>, step_<username>, counter_<username>
function is_2fa_enabled(username) {
	let ctx = cursor();
	
	// Check if plugin is enabled
	let enabled = ctx.get('luci_plugins', PLUGIN_UUID, 'enabled');
	if (enabled != '1')
		return false;

	let safe_username = sanitize_username(username);
	if (!safe_username)
		return false;

	// Check if user has a key configured (key_<username>)
	let key = ctx.get('luci_plugins', PLUGIN_UUID, 'key_' + safe_username);
	if (!key || key == '')
		return false;

	return true;
}

// Verify OTP for user
function verify_otp(username, otp) {
	let ctx = cursor();
	
	if (!otp || otp == '')
		return { success: false };

	let safe_username = sanitize_username(username);
	if (!safe_username)
		return { success: false };

	otp = trim(otp);
	
	if (!match(otp, /^[0-9]{6}$/))
		return { success: false };

	// Get OTP type (type_<username>)
	let otp_type = ctx.get('luci_plugins', PLUGIN_UUID, 'type_' + safe_username) || 'totp';

	if (otp_type == 'hotp') {
		// HOTP verification
		let fd = popen('/usr/libexec/generate_otp.uc ' + safe_username + ' --no-increment --plugin=' + PLUGIN_UUID, 'r');
		if (!fd)
			return { success: false };

		let expected_otp = fd.read('all');
		fd.close();
		expected_otp = trim(expected_otp);
		
		if (!match(expected_otp, /^[0-9]{6}$/))
			return { success: false };

		if (constant_time_compare(expected_otp, otp)) {
			// OTP matches, increment the counter
			let counter = int(ctx.get('luci_plugins', PLUGIN_UUID, 'counter_' + safe_username) || '0');
			ctx.set('luci_plugins', PLUGIN_UUID, 'counter_' + safe_username, '' + (counter + 1));
			ctx.commit('luci_plugins');
			return { success: true };
		}
		return { success: false };
	} else {
		// TOTP verification
		let step = int(ctx.get('luci_plugins', PLUGIN_UUID, 'step_' + safe_username) || '30');
		if (step <= 0) step = 30;
		let current_time = time();
		
		// Check current window and adjacent windows
		for (let offset in [0, -1, 1]) {
			let check_time = int(current_time + (offset * step));
			let fd = popen('/usr/libexec/generate_otp.uc ' + safe_username + ' --no-increment --time=' + check_time + ' --plugin=' + PLUGIN_UUID, 'r');
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
function get_client_ip(http) {
	let ip = null;
	
	if (http && http.getenv) {
		ip = http.getenv('REMOTE_ADDR');
		
		if (ip && (ip == '127.0.0.1' || ip == '::1')) {
			let xff = http.getenv('HTTP_X_FORWARDED_FOR');
			if (xff) {
				let parts = split(xff, ',');
				ip = trim(parts[0]);
			}
		}
	}
	
	return ip || '';
}

return {
	priority: get_priority(),

		check: function(http, user) {
			let client_ip = get_client_ip(http);
			
			// Check if IP is whitelisted
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
			let ctx = cursor();
			let safe_username = sanitize_username(user);
			let otp_type = ctx.get('luci_plugins', PLUGIN_UUID, 'type_' + safe_username) || 'totp';
			
			if (otp_type == 'totp') {
				let time_check = check_time_calibration();
				if (!time_check.calibrated) {
					let strict_mode = ctx.get('luci_plugins', PLUGIN_UUID, 'strict_mode');
					
					if (strict_mode == '1') {
						if (client_ip && is_local_subnet(client_ip)) {
							return { required: false, time_not_calibrated: true, local_subnet_bypass: true };
						} else {
							return {
								required: true,
								blocked: true,
								message: 'System time is not calibrated. Login is blocked for security. Please access from LAN or sync system time.',
								fields: []
							};
						}
					} else {
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

		verify: function(http, user) {
			let client_ip = get_client_ip(http);
			
			// Check if IP is whitelisted
			if (client_ip && is_ip_whitelisted(client_ip)) {
				return { success: true, whitelisted: true };
			}
			
			// Reserve rate limit attempt atomically
			if (client_ip) {
				let rate_check = consume_rate_limit_attempt(client_ip);
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
			
			if (otp)
				otp = trim(otp);
			
			if (!otp || otp == '') {
				return {
					success: false,
					message: 'Please enter your one-time password.'
				};
			}

			let verify_result = verify_otp(user, otp);
			
			if (!verify_result.success) {
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
