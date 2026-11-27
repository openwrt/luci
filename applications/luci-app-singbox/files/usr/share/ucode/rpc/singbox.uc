#!/usr/bin/ucode
/*
 * rpcd backend for luci-app-singbox.
 *
 * Exposes sing-box management operations over ubus as
 * `ubus call rpc.singbox.<method> '{...}'`. The LuCI views currently call
 * the shell scripts directly via fs.exec(); this module provides a stable
 * RPC surface that mirrors those scripts so views can migrate to it without
 * exposing arbitrary shell execution to the browser session.
 *
 * All user-supplied arguments that reach a shell-interpolated position
 * (server names, log level and search filters) are sanitised through
 * shell_safe() before being forwarded. Subscription URLs are passed
 * unescaped as exec() argv — no shell, no injection surface.
 */

'use strict';

import { exec } from 'fs';

const STATUS_BIN = '/usr/share/singbox/status.sh';
const GEN_BIN    = '/usr/share/singbox/generate-config.sh';
const SUB_BIN    = '/usr/share/singbox/update-subscription.sh';
const LOGS_BIN   = '/usr/share/singbox/tail-log.sh';
const INIT_BIN   = '/etc/init.d/sing-box';

function run(path, args) {
	return exec(path, args || []);
}

function is_object(v) { return type(v) == 'object'; }
function is_array(v)  { return type(v) == 'array'; }
function is_string(v) { return type(v) == 'string'; }

function shell_safe(s) {
	let out = '';
	for (let i = 0; i < length(s); i++) {
		const c = s[i];
		if ((c >= 'a' && c <= 'z') ||
		    (c >= 'A' && c <= 'Z') ||
		    (c >= '0' && c <= '9') ||
		    c == '.' || c == '_' || c == '-' || c == ':' || c == '/' || c == ' ')
			out += c;
	}
	return out;
}

function clamp_int(v, lo, hi, dflt) {
	let n = +v;
	if (n != n) n = dflt;
	if (n < lo) n = lo;
	if (n > hi) n = hi;
	return n;
}

return {
	status: function(req) {
		const api = (is_string(req) ? req : (req && req.api)) || '127.0.0.1:9090';
		return run(STATUS_BIN, [ shell_safe(api), 'status' ]);
	},

	servers: function(req) {
		const api = (is_string(req) ? req : (req && req.api)) || '127.0.0.1:9090';
		return run(STATUS_BIN, [ shell_safe(api), 'servers' ]);
	},

	test: function(req, name) {
		let api = '127.0.0.1:9090';
		let srv = null;

		if (is_object(req)) {
			api = req.api || api;
			srv = req.name || req.tag;
		} else if (is_array(req)) {
			api = req[0] || api;
			srv = req[1];
		} else if (is_string(req)) {
			srv = name || req;
		}

		if (!srv)
			return { code: 1, stderr: 'missing server name' };

		return run(STATUS_BIN, [ shell_safe(api), 'test', shell_safe(srv) ]);
	},

	generate: function() { return run(GEN_BIN); },
	apply:    function() { return run(INIT_BIN, [ 'restart' ]); },
	start:    function() { return run(INIT_BIN, [ 'start' ]); },
	stop:     function() { return run(INIT_BIN, [ 'stop' ]); },
	restart:  function() { return run(INIT_BIN, [ 'restart' ]); },
	reload:   function() { return run(INIT_BIN, [ 'reload' ]); },

	importSubscription: function(req) {
		let url = null;
		if (is_object(req))      url = req.url;
		else if (is_string(req)) url = req;

		if (!url)
			return { code: 1, stderr: 'missing subscription url' };

		return run(SUB_BIN, [ url ]);
	},

	logs: function(req) {
		let opts = req;
		if (!is_object(opts))
			opts = { lines: req };

		const lines = String(clamp_int(opts.lines, 1, 2000, 200));
		const level = opts.level ? shell_safe(opts.level) : '';
		const search = opts.search ? shell_safe(opts.search) : '';

		// logread-based — matches the package's syslog logging backend.
		return run(LOGS_BIN, [ lines, level, search ]);
	}
};
