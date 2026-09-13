'use strict';

import { glob, basename, open, readfile, writefile } from 'fs';
import { cursor } from 'uci';
import { syslog, LOG_INFO, LOG_WARNING, LOG_AUTHPRIV } from 'log';

// Plugin cache
let auth_plugins = null;

// Plugin path following master's plugin architecture
const PLUGIN_PATH = '/usr/share/ucode/luci/plugins/auth/login';
const VERIFY_RATE_LIMIT_FILE = '/tmp/luci-auth-verify-rate-limit.json';
const VERIFY_RATE_LIMIT_LOCK_FILE = '/tmp/luci-auth-verify-rate-limit.lock';
const VERIFY_RATE_LIMIT_MAX_ATTEMPTS = 3;
const VERIFY_RATE_LIMIT_WINDOW = 30;
const VERIFY_RATE_LIMIT_LOCKOUT = 60;
const VERIFY_RATE_LIMIT_STALE = 86400;

function verify_rate_limit_key(user, ip) {
	return `${user || '?'}|${ip || '?'}`;
}

function load_verify_rate_limit_state() {
	let content = readfile(VERIFY_RATE_LIMIT_FILE);
	let state = content ? json(content) : null;

	return type(state) == 'object' ? state : {};
}

function cleanup_verify_rate_limit_state(state, now) {
	let keep_window = VERIFY_RATE_LIMIT_LOCKOUT;
	if (keep_window < VERIFY_RATE_LIMIT_STALE)
		keep_window = VERIFY_RATE_LIMIT_STALE;

	let stale_before = now - keep_window;
	let cleaned = {};

	for (let key, entry in state) {
		if (type(entry) != 'object')
			continue;

		let locked_until = int(entry.locked_until || 0);
		let attempts = [];

		if (type(entry.attempts) == 'array') {
			for (let attempt in entry.attempts) {
				attempt = int(attempt);
				if (attempt > (now - VERIFY_RATE_LIMIT_WINDOW))
					push(attempts, attempt);
			}
		}

		if (locked_until > now || length(attempts) > 0 || locked_until >= stale_before)
			cleaned[key] = { attempts, locked_until };
	}

	return cleaned;
}

function with_verify_rate_limit_state(cb) {
	let lockfd = open(VERIFY_RATE_LIMIT_LOCK_FILE, 'w', 0600);
	if (!lockfd || lockfd.lock('xn') !== true) {
		lockfd?.close();
		return null;
	}

	let now = time();
	let state = cleanup_verify_rate_limit_state(load_verify_rate_limit_state(), now);
	let result = cb(state, now);
	writefile(VERIFY_RATE_LIMIT_FILE, sprintf('%J', state));

	lockfd.lock('u');
	lockfd.close();

	return result;
}

function check_verify_rate_limit(user, ip) {
	let key = verify_rate_limit_key(user, ip);
	let result = with_verify_rate_limit_state((state, now) => {
		let entry = state[key];
		let locked_until = int(entry?.locked_until || 0);

		return {
			limited: locked_until > now,
			remaining: (locked_until > now) ? (locked_until - now) : 0
		};
	});

	if (!result) {
		syslog(LOG_WARNING|LOG_AUTHPRIV, 'luci: unable to read auth verify rate-limit state');
		return { limited: false, remaining: 0 };
	}

	return result;
}

function note_verify_failure(user, ip) {
	let key = verify_rate_limit_key(user, ip);
	let result = with_verify_rate_limit_state((state, now) => {
		let entry = state[key] || { attempts: [], locked_until: 0 };
		let locked_until = int(entry.locked_until || 0);

		if (locked_until > now)
			return { limited: true, remaining: locked_until - now };

		let attempts = [];
		for (let attempt in entry.attempts) {
			attempt = int(attempt);
			if (attempt > (now - VERIFY_RATE_LIMIT_WINDOW))
				push(attempts, attempt);
		}

		push(attempts, now);

		if (length(attempts) >= VERIFY_RATE_LIMIT_MAX_ATTEMPTS) {
			locked_until = now + VERIFY_RATE_LIMIT_LOCKOUT;
			state[key] = { attempts: [], locked_until };

			return { limited: true, remaining: locked_until - now };
		}

		state[key] = { attempts, locked_until: 0 };
		return { limited: false, remaining: 0 };
	});

	if (!result) {
		syslog(LOG_WARNING|LOG_AUTHPRIV, 'luci: unable to write auth verify rate-limit state');
		return { limited: false, remaining: 0 };
	}

	return result;
}

function clear_verify_rate_limit(user, ip) {
	let key = verify_rate_limit_key(user, ip);
	with_verify_rate_limit_state((state, now) => {
		delete state[key];
		return true;
	});
}

function normalize_assets(uuid, assets) {
	let rv = [];

	if (type(assets) != 'array')
		return rv;

	for (let asset in assets) {
		let src = null;

		if (type(asset) == 'string')
			src = asset;
		else if (type(asset) == 'object' && type(asset.src) == 'string' && (asset.type == null || asset.type == 'script'))
			src = asset.src;

		if (type(src) != 'string')
			continue;

		if (!match(src, sprintf("^/luci-static/plugins/%s/", uuid)))
			continue;

		if (match(src, /\.\.|[\r\n\t ]/))
			continue;

		push(rv, { type: 'script', src: src });
	}

	return rv;
}

// Load all enabled authentication plugins.
//
// Plugins are loaded from PLUGIN_PATH and must:
// - Have a 32-character hex UUID filename (e.g., bb4ea47fcffb44ec9bb3d3673c9b4ed2.uc)
// - Export a plugin object
// - Plugin object must have check(http, user) and verify(http, user) methods
//
// Configuration hierarchy:
// - luci_plugins.global.enabled = '1'
// - luci_plugins.global.auth_login_enabled = '1'
// - luci_plugins.<uuid>.enabled = '1'
//
// Returns array of loaded plugin objects
export function load() {
	let uci = cursor();

	// Check global plugin system enabled
	if (uci.get("luci_plugins", "global", "enabled") != "1")
		return [];

	// Check auth plugins class enabled
	if (uci.get("luci_plugins", "global", "auth_login_enabled") != "1")
		return [];

	// Return cached plugins if already loaded
	if (auth_plugins != null)
		return auth_plugins;

	auth_plugins = [];

	// Load auth plugins from plugin directory
	for (let path in glob(PLUGIN_PATH + '/*.uc')) {
		try {
			let code = loadfile(path);
			if (!code)
				continue;

			let plugin = call(code);
			if (type(plugin) != 'object')
				continue;

			// Extract UUID from filename (32 char hex without dashes)
			let filename = basename(path);
			let uuid = replace(filename, /\.uc$/, '');
			
			// Validate UUID format
			if (!match(uuid, /^[a-f0-9]{32}$/))
				continue;

			// Check if this specific plugin is enabled
			if (uci.get("luci_plugins", uuid, "enabled") != "1")
				continue;

			// Validate plugin interface
			if (type(plugin) == 'object' &&
				type(plugin.check) == 'function' &&
				type(plugin.verify) == 'function') {
				
				plugin.uuid = uuid;
				plugin.name = uci.get("luci_plugins", uuid, "name") || uuid;
				push(auth_plugins, plugin);
			}
		}
		catch (e) {
			syslog(LOG_WARNING,
				sprintf("luci: failed to load auth plugin from %s: %s", path, e));
		}
	}

	// Sort by priority (lower = first)
	auth_plugins = sort(auth_plugins, (a, b) => (a.priority || 50) - (b.priority || 50));

	return auth_plugins;
};

// Check if any plugin requires additional authentication.
//
// Iterates through enabled plugins and calls their check() method.
// Returns on first plugin that requires authentication.
//
// http - HTTP request object
// user - Username being authenticated
//
// Returns object with:
//   pending - boolean, true if additional auth required
//   plugin - the plugin requiring auth (if pending)
//   fields - array of form fields to render (if pending)
//   message - message to display (if pending)
export function get_challenges(http, user) {
	let plugins = load();
	let challenges = [];
	let fields = [];
	let messages = [];
	let html_parts = [];
	let assets = [];

	for (let plugin in plugins) {
		try {
			let result = plugin.check(http, user);
			if (result && result.required) {
				push(challenges, {
					uuid: plugin.uuid,
					name: plugin.name,
					priority: plugin.priority ?? 50,
					fields: result.fields || [],
					message: result.message || '',
					html: result.html || null,
					assets: normalize_assets(plugin.uuid, result.assets)
				});
			}
		}
		catch (e) {
			syslog(LOG_WARNING,
				sprintf("luci: auth plugin '%s' check error: %s", plugin.name, e));
		}
	}

	if (!length(challenges))
		return { pending: false, challenges: [] };

	challenges = sort(challenges, (a, b) => a.priority - b.priority);

	for (let challenge in challenges) {
		for (let field in challenge.fields)
			push(fields, field);

		if (challenge.message)
			push(messages, challenge.message);

		if (challenge.html)
			push(html_parts, challenge.html);

		for (let asset in challenge.assets)
			push(assets, asset);
	}

	return {
		pending: true,
		challenges: challenges,
		fields: fields,
		message: length(messages) ? join(' ', messages) : 'Additional verification required',
		html: length(html_parts) ? join('\n', html_parts) : null,
		assets: assets
	};
};

// Verify user's response to authentication challenge.
//
// Iterates through enabled plugins and verifies each that requires auth.
// All requiring plugins must pass for verification to succeed.
//
// http - HTTP request object with form values
// user - Username being authenticated
//
// Returns object with:
//   success - boolean, true if all verifications passed
//   message - error message (if failed)
//   plugin - the plugin that failed (if failed)
export function verify(http, user, required_plugins) {
	let plugins = load();
	let plugin_map = {};
	let client_ip = http.getenv("REMOTE_ADDR") || "?";
	let rate_limit = check_verify_rate_limit(user, client_ip);

	if (type(required_plugins) != 'array')
		return { success: false, message: 'Authentication plugin state missing' };

	if (rate_limit.limited)
		return {
			success: false,
			message: sprintf('Too many failed authentication attempts. Please try again in %d seconds.', rate_limit.remaining)
		};

	for (let plugin in plugins)
		plugin_map[plugin.uuid] = plugin;

	for (let plugin_uuid in required_plugins) {
		let plugin = plugin_map[plugin_uuid];

		if (type(plugin) != 'object') {
			syslog(LOG_WARNING,
				sprintf("luci: auth plugin '%s' not loaded for verification", plugin_uuid));
			return {
				success: false,
				message: 'Authentication plugin unavailable'
			};
		}

		try {
			let verify_result = plugin.verify(http, user);
			if (!(verify_result && verify_result.success)) {
				let fail_limit = note_verify_failure(user, client_ip);
				syslog(LOG_WARNING|LOG_AUTHPRIV,
					sprintf("luci: auth plugin '%s' verification failed for %s from %s",
						plugin.name, user || "?", http.getenv("REMOTE_ADDR") || "?"));
				return {
					success: false,
					message: fail_limit.limited
						? sprintf('Too many failed authentication attempts. Please try again in %d seconds.', fail_limit.remaining)
						: ((verify_result && verify_result.message) || 'Authentication failed'),
					plugin: plugin
				};
			}

			syslog(LOG_INFO|LOG_AUTHPRIV,
				sprintf("luci: auth plugin '%s' verification succeeded for %s from %s",
					plugin.name, user || "?", http.getenv("REMOTE_ADDR") || "?"));
		}
		catch (e) {
			syslog(LOG_WARNING,
				sprintf("luci: auth plugin '%s' verify error: %s", plugin.name, e));
			return {
				success: false,
				message: 'Authentication plugin error'
			};
		}
	}

	clear_verify_rate_limit(user, client_ip);
	return { success: true };
};

// Clear plugin cache.
//
// Call this if plugin configuration changes and you need
// to reload plugins without restarting uhttpd.
export function reset() {
	auth_plugins = null;
};
