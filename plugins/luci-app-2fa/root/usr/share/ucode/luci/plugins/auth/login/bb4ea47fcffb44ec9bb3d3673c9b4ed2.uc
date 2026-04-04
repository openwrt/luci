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

import { popen, readfile, writefile, open } from 'fs';
import { connect } from 'ubus';
import { cursor } from 'uci';
import { syslog, LOG_INFO, LOG_WARNING, LOG_AUTHPRIV } from 'log';

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
const RATE_LIMIT_STALE_SECONDS = 86400;
let RATE_LIMIT_LOCK_HANDLE = null;
let ubus = connect();

function get_priority() {
	let ctx = cursor();
	let value = ctx.get('luci_plugins', PLUGIN_UUID, 'priority');

	if (!value || !match(value, /^-?[0-9]+$/))
		return DEFAULT_PRIORITY;

	return int(value);
}

function get_system_min_valid_time_fallback() {
	let newest = 0;
	let fd = popen('find /etc -type f -exec date -r {} +%s \\; 2>/dev/null', 'r');
	if (!fd)
		return DEFAULT_MIN_VALID_TIME;

	for (let line = fd.read('line'); line; line = fd.read('line')) {
		line = trim(line);
		if (!match(line, /^[0-9]+$/))
			continue;

		let ts = int(line);
		if (ts > newest)
			newest = ts;
	}

	fd.close();

	return newest > 0 ? newest : DEFAULT_MIN_VALID_TIME;
}

// Check if system time is calibrated (not earlier than minimum valid time)
function check_time_calibration() {
	let ctx = cursor();
	let config_time = ctx.get('luci_plugins', PLUGIN_UUID, 'min_valid_time');
	let min_valid_time = config_time ? int(config_time) : get_system_min_valid_time_fallback();
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

	if (index(ip, '/') >= 0)
		return parse_cidr(ip) != null;

	return iptoarr(ip) != null;
}

function parse_cidr(cidr) {
	let parts = split(cidr, '/');
	if (length(parts) < 1 || length(parts) > 2)
		return null;

	let addr = iptoarr(parts[0]);
	if (!addr)
		return null;

	let max_prefix = length(addr) * 8;
	let prefix = max_prefix;

	if (length(parts) == 2) {
		if (!match(parts[1], /^[0-9]+$/))
			return null;

		prefix = int(parts[1]);
		if (prefix < 0 || prefix > max_prefix)
			return null;
	}

	return { addr, prefix };
}

function masked_bytes(bytes, prefix) {
	let out = [];
	let bits = prefix;

	for (let b in bytes) {
		if (bits >= 8) {
			push(out, b);
			bits -= 8;
		}
		else if (bits <= 0) {
			push(out, 0);
		}
		else {
			let mask = ((0xFF << (8 - bits)) & 0xFF);
			push(out, b & mask);
			bits = 0;
		}
	}

	return out;
}

function matches_prefix(addr, network, prefix) {
	if (length(addr) != length(network))
		return false;

	let a = masked_bytes(addr, prefix);
	let n = masked_bytes(network, prefix);
	for (let i = 0; i < length(a); i++) {
		if (a[i] != n[i])
			return false;
	}

	return true;
}

function netmask_to_prefix(mask) {
	let prefix = 0;
	let zero_seen = false;

	for (let b in mask) {
		for (let bit = 7; bit >= 0; bit--) {
			if ((b & (1 << bit)) != 0) {
				if (zero_seen)
					return null;
				prefix++;
			}
			else {
				zero_seen = true;
			}
		}
	}

	return prefix;
}

function push_interface_subnets(subnets, addrs, expected_len, max_mask) {
	if (type(addrs) != 'array')
		return;

	for (let addr in addrs) {
		if (!addr.address || addr.mask == null)
			continue;

		let ip_addr = iptoarr(addr.address);
		let mask = int(addr.mask);
		if (ip_addr && length(ip_addr) == expected_len && mask >= 0 && mask <= max_mask)
			push(subnets, arrtoip(masked_bytes(ip_addr, mask)) + '/' + mask);
	}
}

// Check if an IP is in a CIDR range
function ip_in_cidr(ip, cidr) {
	let addr = iptoarr(ip);
	let network = parse_cidr(cidr);
	if (!addr || !network)
		return false;

	return matches_prefix(addr, network.addr, network.prefix);
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
	let status = ubus?.call('network.interface.lan', 'status', {});
	push_interface_subnets(subnets, status?.['ipv4-address'], 4, 32);
	push_interface_subnets(subnets, status?.['ipv6-address'], 16, 128);

	// Fallback to UCI network config
	if (length(subnets) == 0) {
		let ctx = cursor();
		let lan_ipaddr = ctx.get('network', 'lan', 'ipaddr');
		let lan_netmask = ctx.get('network', 'lan', 'netmask');

		if (lan_ipaddr && lan_netmask) {
			let ip_addr = iptoarr(lan_ipaddr);
			let mask_addr = iptoarr(lan_netmask);
			if (ip_addr && mask_addr && length(ip_addr) == 4 && length(mask_addr) == 4) {
				let prefix = netmask_to_prefix(mask_addr);
				if (prefix != null)
					push(subnets, arrtoip(masked_bytes(ip_addr, prefix)) + '/' + prefix);
			}
		}

		let lan_ip6addr = ctx.get('network', 'lan', 'ip6addr');
		if (lan_ip6addr) {
			let cidr = parse_cidr(lan_ip6addr);
			if (cidr && length(cidr.addr) == 16)
				push(subnets, arrtoip(masked_bytes(cidr.addr, cidr.prefix)) + '/' + cidr.prefix);
		}
	}

	return subnets;
}

// Check if IP is in a LAN subnet
function is_local_subnet(ip) {
	if (!ip || ip == '')
		return false;

	let ip_addr = iptoarr(ip);
	if (!ip_addr)
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

function cleanup_rate_limit_state(state, now, window, lockout) {
	let changed = false;
	let cleaned = {};
	let min_attempt = now - window;
	let keep_window = lockout;
	if (keep_window < RATE_LIMIT_STALE_SECONDS)
		keep_window = RATE_LIMIT_STALE_SECONDS;
	let stale_before = now - keep_window;
	let original_entries = 0;
	let cleaned_entries = 0;

	for (let ip, ip_state in state) {
		original_entries++;

		if (type(ip_state) != 'object') {
			changed = true;
			continue;
		}

		let locked_until = int(ip_state.locked_until || 0);
		let attempts = [];

		if (type(ip_state.attempts) == 'array') {
			for (let attempt in ip_state.attempts) {
				attempt = int(attempt);
				if (attempt > min_attempt)
					push(attempts, attempt);
			}
		}

		if (locked_until > now || length(attempts) > 0) {
			cleaned[ip] = { attempts, locked_until };
			cleaned_entries++;
		}
		else if (locked_until < stale_before) {
			changed = true;
		}
	}

	if (cleaned_entries != original_entries)
		changed = true;

	return { state: cleaned, changed };
}

// Save rate limit state
function save_rate_limit_state(state) {
	writefile(RATE_LIMIT_FILE, sprintf('%J', state));
}

function lock_rate_limit_state() {
	if (RATE_LIMIT_LOCK_HANDLE)
		return true;

	let fd = open(RATE_LIMIT_LOCK_FILE, 'w', 0600);
	if (!fd)
		return false;

	if (fd.lock('xn') !== true) {
		fd.close();
		return false;
	}

	RATE_LIMIT_LOCK_HANDLE = fd;
	return true;
}

function unlock_rate_limit_state() {
	if (!RATE_LIMIT_LOCK_HANDLE)
		return;

	RATE_LIMIT_LOCK_HANDLE.lock('u');
	RATE_LIMIT_LOCK_HANDLE.close();
	RATE_LIMIT_LOCK_HANDLE = null;
}

function evaluate_rate_limit(ip, consume_attempt) {
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
	let cleanup = cleanup_rate_limit_state(state, now, window, lockout);
	state = cleanup.state;
	if (cleanup.changed)
		save_rate_limit_state(state);
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

	if (consume_attempt)
		push(ip_state.attempts, now);

	save_rate_limit_state(state);
	result = { allowed: true, remaining: max_attempts - length(ip_state.attempts), locked_until: 0 };
	unlock_rate_limit_state();
	return result;
}

// Check rate limit
function check_rate_limit(ip) {
	return evaluate_rate_limit(ip, false);
}

// Reserve a rate-limit attempt atomically before verification
function consume_rate_limit_attempt(ip) {
	return evaluate_rate_limit(ip, true);
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
			syslog(LOG_INFO|LOG_AUTHPRIV,
				sprintf("luci: 2FA bypassed for %s from %s due to IP whitelist",
					user || '?', client_ip || '?'));
			return { success: true, whitelisted: true };
		}

			// Reserve rate limit attempt atomically
			if (client_ip) {
				let rate_check = consume_rate_limit_attempt(client_ip);
				if (!rate_check.allowed) {
					let remaining_seconds = rate_check.locked_until - time();
					syslog(LOG_WARNING|LOG_AUTHPRIV,
						sprintf("luci: 2FA blocked for %s from %s due to rate limit (%d seconds remaining)",
							user || '?', client_ip || '?', remaining_seconds));
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
				syslog(LOG_WARNING|LOG_AUTHPRIV,
					sprintf("luci: 2FA verification failed for %s from %s due to missing OTP",
						user || '?', client_ip || '?'));
				return {
					success: false,
					message: 'Please enter your one-time password.'
				};
			}

			let verify_result = verify_otp(user, otp);

			if (!verify_result.success) {
				syslog(LOG_WARNING|LOG_AUTHPRIV,
					sprintf("luci: 2FA verification failed for %s from %s due to invalid OTP",
						user || '?', client_ip || '?'));
				return {
					success: false,
					message: 'Invalid one-time password. Please try again.'
				};
			}

			// Clear rate limit on successful login
			if (client_ip) clear_rate_limit(client_ip);

			syslog(LOG_INFO|LOG_AUTHPRIV,
				sprintf("luci: 2FA verification succeeded for %s from %s",
					user || '?', client_ip || '?'));
			
			return { success: true };
	}
};
