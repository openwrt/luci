#!/usr/bin/env ucode
// SPDX-License-Identifier: Apache-2.0
'use strict';

// rpcd-mod-ucode plugin for luci-app-trafficctl: the ubus object
// luci.trafficctl. rpcd loads this file once, at its start, and calls the
// methods inside its own process; `/etc/init.d/rpcd reload` picks up a new
// version and keeps the sessions (the trafficctl and luci-app-trafficctl
// postinsts do).
//
// The settings (uci), their validation, the activity log and the device names
// are handled here, in process. Everything that reads conntrack, nft or tc,
// talks to hostapd or the network, or waits, is a /usr/sbin/trafficctl
// command run through rpcd's own file.exec as a deferred ubus call, so rpcd
// keeps serving other callers meanwhile. Replies keep the v1.30.0 shell
// plugin's JSON; rpcd needs an object, so arrays come wrapped as
// {"result": ...}.
//
// Nothing here may call an object rpcd itself serves (session, file, uci,
// luci, rrdns) synchronously: rpcd would wait on itself. Those go through
// chain() below. procd's (service) and netifd's are fine. Nor may anything
// in process run lib.run/sh/run_rc with a timeout: system() with one blocks
// SIGCHLD and waits for it, which takes the signal rpcd's own children
// (file.exec) report their exit with.

import { connect } from 'ubus';
import * as lib from 'trafficctl.lib';
import * as notify from 'trafficctl.notify';

const CLI = '/usr/sbin/trafficctl';

// A command still running after this gets an error reply; rpcd's file.exec
// kills it at rpcd's own exec timeout (-t, 120 s by default).
// TCTL_CLI_TIMEOUT_MS is for the tests: rpcd starts with its own env.
const CLI_TIMEOUT_S = int((lib.valid_int(getenv('TCTL_CLI_TIMEOUT_MS') ?? '', 1000, 110000) ?? 60000) / 1000);

// file.exec answers NOT_SUPPORTED, with no output, once a command prints
// 256 KiB (RPC_FILE_MAX_SIZE); the device detail is capped below that.
const DEVICE_MAX_BYTES = 200000;

// ubus status codes (libubus); rpcd defines them as globals too.
const ST_INVALID_ARGUMENT = 2, ST_NOT_FOUND = 4, ST_NO_DATA = 5, ST_TIMEOUT = 7,
	ST_NOT_SUPPORTED = 8;

// Same order and types as the shell plugin's table, plus persist_rules,
// which settings.js has always sent. rpcd turns them into a strict policy:
// an argument of another type, a null or an undeclared one is refused with
// INVALID_ARGUMENT before a method runs.
const SIGNATURES = {
	summary: {},
	device: { ip: 'str', proto: 'str' },
	bytes: {},
	ifaces: {},
	block: { ip: 'str', label: 'str' },
	unblock: { ip: 'str', label: 'str' },
	macfilter_add: { ip: 'str' },
	macfilter_remove: { ip: 'str', mac: 'str' },
	ratelimit: { ip: 'str', rate_kbit: 'int', label: 'str', mode: 'str', rate_kbit_up: 'int' },
	ratelimit_stats: {},
	subnets: {},
	shape_add: { ip: 'str', rate_kbit: 'int', label: 'str', rate_kbit_up: 'int' },
	shape_remove: { ip: 'str', label: 'str' },
	shape_status: { ip: 'str' },
	shape_stats: {},
	rules_list: {},
	rdns: { ip: 'str' },
	netify_status: {},
	netify_list: {},
	netify_collect: { secs: 'int' },
	names_list: {},
	name_set: { ip: 'str', name: 'str' },
	name_clear: { ip: 'str' },
	portfw_list: {},
	portfw_ctl: { action: 'str', scope: 'str', proto: 'str', ip: 'str', port: 'str', rate_kbit: 'int' },
	config_get: {},
	config_set: { enabled: 'bool', default_mode: 'str', sw: 'bool', hw: 'bool', poll_interval: 'int', avg_window: 'int' },
	telegram_config_get: {},
	telegram_config_set: { enabled: 'bool', bot_token: 'str', chat_id: 'str', poll_interval: 'int',
		notify_new_device: 'bool', notify_known_device: 'bool', control_enabled: 'bool',
		notify_template: 'str', btn_block_inet: 'bool', btn_block_wifi: 'bool',
		btn_limiter: 'bool', btn_shaper: 'bool' },
	telegram_test: { bot_token: 'str', chat_id: 'str', message: 'str' },
	// ── notifications ──
	notify_config_get: {},
	notify_config_set: { sender: 'str', enabled: 'bool', events: 'str', scan: 'str', scan_interval: 'int',
		bot_token: 'str', chat_id: 'str', template: 'str', server: 'str', topic: 'str', token: 'str',
		priority: 'int', url: 'str', auth: 'str', to: 'str', 'from': 'str', account: 'str' },
	notify_test: { sender: 'str' },
	// ── end notifications ──
	newdevice_config_get: {},
	newdevice_config_set: { enabled: 'bool', limit_kbit: 'int', limit_mode: 'str' },
	logging_config_get: {},
	logging_config_set: { enabled: 'bool', log_file: 'str', max_lines: 'int', syslog: 'bool',
		log_blocks: 'bool', log_ratelimits: 'bool', log_shapes: 'bool', log_telegram: 'bool',
		log_config: 'bool', persist_rules: 'bool' },
	cut_status: {},
	cut_set: { active: 'bool', duration: 'int', persist: 'bool' },
	activity_log: { lines: 'int' },
	history_status: {},
	history_read: { period: 'str', to: 'str' },
	history_read_ifaces: { period: 'str', to: 'str' },
	history_periods: {},
	history_config_get: {},
	history_config_set: { enabled: 'bool', dir: 'str', period: 'str', interval: 'int',
		sample_interval: 'int', keep: 'int', interfaces: 'bool' },
	history_flush: {},
	version: {},
};

// ── arguments ───────────────────────────────────────────────────────────────

// An argument as the shell plugin saw it through jsonfilter: absent is '',
// booleans 'true'/'false', numbers their digits. rpcd has checked the types
// already; the other cases stay for a caller that bypasses the policy (the
// tests). A string stops at a NUL as it did in C.
function arg(a, k) {
	let v = a[k];
	switch (type(v)) {
	case 'string':
		return split(v, chr(0))[0];
	case 'int':
		return sprintf('%d', v);
	case 'bool':
		return v ? 'true' : 'false';
	case 'double':
		v = sprintf('%.14g', v);
		return match(v, /[.en]/) ? v : v + '.0';
	case 'array':
	case 'object':
		return lib.to_json(v);
	default:
		return '';
	}
}

function digits(s) {
	return !!match(s, /^[0-9]+$/);
}

// A stored value as busybox printf '%d' printed it: strtoll base 0 (leading
// blanks, a sign, 0x hex, 0 octal), and 0 for trailing junk or an overflow.
// dash differs (it keeps the leading digits of '12x'); the router runs ash.
function num(s, dflt) {
	if (s == null || s == '')
		return dflt;
	let m = match(s, /^[ \t\n\v\f\r]*([+-]?)(0[xX][0-9a-fA-F]+|0[0-7]*|[1-9][0-9]*)$/);
	if (!m)
		return 0;
	let d = m[2], base = 10, i = 0, v = 0;
	if (length(d) > 2 && (substr(d, 0, 2) == '0x' || substr(d, 0, 2) == '0X'))
		base = 16, i = 2;
	else if (length(d) > 1 && substr(d, 0, 1) == '0')
		base = 8, i = 1;
	for (; i < length(d); i++) {
		let c = ord(lc(substr(d, i, 1)));
		let n = (c >= 97) ? c - 87 : c - 48;
		if (v > (9223372036854775807 - n) / base)
			return 0;
		v = v * base + n;
	}
	return (m[1] == '-') ? -v : v;
}

function bool01(s) {
	return (s == 'true') ? '1' : '0';
}

function fail(msg) {
	return { ok: false, msg };
}

const OK = { ok: true };

// A setter whose commit failed has changed nothing.
function save(conf) {
	return lib.commit(conf) ? null : fail('could not save the ' + conf + ' settings');
}

// ── who is asking (activity log attribution) ───────────────────────────────

// uhttpd adds the caller's session to every call; rpcd hands it on with the
// arguments. The session holds the login name; a peer address only when
// something stored one there. Only a method that logs or changes something
// asks for it: the read methods below are the dashboard's polls.
const READ_ONLY = {
	version: true, summary: true, device: true, bytes: true, ifaces: true,
	ratelimit_stats: true, shape_stats: true, rdns: true, subnets: true,
	portfw_list: true, names_list: true, netify_status: true, netify_list: true,
	shape_status: true, rules_list: true, config_get: true, telegram_config_get: true,
	logging_config_get: true, newdevice_config_get: true, history_status: true,
	history_read: true, history_read_ifaces: true, history_periods: true,
	history_config_get: true, notify_config_get: true,
};

// The methods whose reply is { result: ... }, an error included.
const RESULT = {
	summary: true, bytes: true, ifaces: true, ratelimit_stats: true, subnets: true,
	shape_stats: true, rules_list: true, netify_list: true, names_list: true,
	portfw_list: true, history_status: true, history_periods: true, history_read: true,
	history_read_ifaces: true, history_config_get: true, history_flush: true,
};

// The session's values, or {} when there are none.
function caller(data) {
	let env_src = getenv('REMOTE_ADDR'), env_user = getenv('USERNAME');
	data = (type(data) == 'object') ? data : {};
	return {
		via: 'luci',
		src: (env_src != null && env_src != '') ? env_src : (type(data.peer) == 'string' ? data.peer : ''),
		user: (env_user != null && env_user != '') ? env_user
			: (type(data.username) == 'string' && data.username != '') ? data.username : 'root',
	};
}

// ── deferred ubus calls ─────────────────────────────────────────────────────

// One connection for the plugin's life, opened on the first call. The
// deferred calls' timeout is the connection's.
let conn = null;

function bus() {
	conn ??= connect(getenv('TCTL_UBUS_SOCKET'), CLI_TIMEOUT_S);
	return conn;
}

// A request in flight: x.req is rpcd's request, x.who the caller.
// What a method hands back: an object (the reply), an int (a ubus status,
// no reply data) or the resource of a deferred call that replies later.
function send(x, v) {
	try {
		if (type(v) == 'object')
			x.req.reply(v);
		else if (type(v) == 'int')
			x.req.error(v);
		else if (type(v) != 'resource')
			x.req.error(ST_NO_DATA);
	}
	catch (e) {
		// Replied already: rpcd's guard timer was first (its exec
		// timeout, rpcd -t, is below the plugin's limit). One line in
		// the log, since the caller only saw "Request timed out".
		warn(sprintf('luci.trafficctl %s: the reply came after rpcd timed the call out, dropped (%s)\n',
			x.method, e.message));
	}
}

function internal_error(x, e) {
	warn(sprintf('luci.trafficctl %s: %s\n', x.method, e.message));
	let r = fail('internal error: ' + e.message);
	return RESULT[x.method] ? { result: null, ok: false, msg: r.msg } : r;
}

// obj.method(args) as a deferred call; fn(rc, reply) makes the method's
// reply out of its answer. Returns the deferred call, or fn's value when fn
// ran at once: 2022-12 calls the callback before returning null when the
// invoke fails, and an object that cannot be found never answers at all.
// fn runs once, and never throws back into ubus: on 2022-12 an exception in
// that synchronous callback ends rpcd's main loop.
function chain(x, obj, method, args, fn) {
	let st = { inside: true, fired: false, result: null };
	let cb = (rc, reply) => {
		if (st.fired)
			return;
		st.fired = true;
		let v = null;
		try {
			v = fn(rc, reply);
		}
		catch (e) {
			v = internal_error(x, e);
		}
		if (st.inside)
			st.result = v;
		else
			send(x, v);
	};
	let d = null;
	// A second try on a new connection: ubusd may have restarted.
	for (let i = 0; i < 2; i++) {
		let c = bus();
		d = c ? c.defer(obj, method, args, cb) : null;
		if (d != null || st.fired)
			break;
		conn = null;
	}
	if (d == null && !st.fired)
		cb(ST_NOT_FOUND, null);
	st.inside = false;
	return (d != null) ? d : st.result;
}

// ── the CLI ─────────────────────────────────────────────────────────────────

// rpcd's file.exec runs it: no shell, stdin /dev/null, the caller in the
// environment as it was from the shell plugin. stdout is the reply, the exit
// status and stderr are dropped as before. Never with ubus_rpc_session:
// without one, file.exec skips the ACL check, which the UI's session would
// fail (it has no exec grant, and needs none).
function run_cli(x, argv, env, fn) {
	let e = { TCTL_VIA: 'luci', TCTL_SRC: x.who.src, TCTL_USER: x.who.user };
	for (let k, v in env ?? {})
		e[k] = v;
	return chain(x, 'file', 'exec', { command: lib.path(CLI), params: argv, env: e }, (rc, r) => {
		if (rc == ST_TIMEOUT)
			return fn(sprintf('trafficctl %s did not finish within %d s', argv[0], CLI_TIMEOUT_S), null);
		if (rc == ST_NOT_SUPPORTED)
			return fn(sprintf('trafficctl %s printed more than rpcd takes (256 KiB)', argv[0]), null);
		if (rc != 0)
			return fn(sprintf('trafficctl %s could not be run (ubus status %d)', argv[0], rc), null);
		return fn(null, (type(r?.stdout) == 'string') ? r.stdout : '');
	});
}

// What rpcd made of an exec plugin's output: its first JSON value, an object
// as the reply, null as NO_DATA, anything else as INVALID_ARGUMENT.
function parse_reply(out) {
	let v = null;
	try {
		v = json(out);
	}
	catch (e) {
		return ST_INVALID_ARGUMENT;
	}
	return (type(v) == 'object') ? v : (v == null) ? ST_NO_DATA : ST_INVALID_ARGUMENT;
}

function cli(x, argv, env) {
	return run_cli(x, argv, env, (err, out) => err ? fail(err) : parse_reply(out));
}

// A command that prints an array (or any value rpcd cannot take bare).
function wrapped(x, argv) {
	return run_cli(x, argv, null, (err, out) => {
		if (err)
			return { result: null, ok: false, msg: err };
		out = trim(out);
		if (!length(out))
			return { result: null };
		try {
			return { result: json(out) };
		}
		catch (e) {
			return ST_INVALID_ARGUMENT;
		}
	});
}

// Runs the init script's actions one after the other, in the background:
// every one of them, enable and stop included, may wait on procd or on the
// service, and a wait here would stop all of rpcd. The reply does not wait.
function init_script(name, actions) {
	let p = '/etc/init.d/' + name;
	if (!lib.is_file(p))
		return;
	lib.sh('for a in ' + lib.qv(actions) + '; do ' + lib.q(lib.path(p)) + ' "$a"; done &');
}

// ── uci ─────────────────────────────────────────────────────────────────────

function uget(sect, opt) {
	return lib.uci_get('trafficctl', sect, opt);
}

// An empty value is no value: older libuci ignored it, newer deletes it.
function uset(sect, opt, val) {
	let c = lib.cursor();
	if (val == '')
		c.delete('trafficctl', sect, opt);
	else
		c.set('trafficctl', sect, opt, val);
}

function ensure_section(name) {
	let c = lib.cursor();
	if (c.get('trafficctl', name) == null)
		c.set('trafficctl', name, name);
}

function fw_defaults() {
	let name = null;
	lib.uci_foreach('firewall', 'defaults', (s) => {
		name = s['.name'];
		return false;
	});
	return name;
}

function fw_get(opt) {
	let s = fw_defaults();
	return (s == null) ? null : lib.uci_get('firewall', s, opt);
}

// ── router state ────────────────────────────────────────────────────────────

function bot_running() {
	let svc = lib.ubus_call('service', 'list', { name: 'trafficctl-telegram' })?.['trafficctl-telegram'];
	for (let k, inst in svc?.instances ?? {})
		if (inst?.running)
			return true;
	return false;
}

// The installed luci-app-trafficctl, from the opkg or the apk database.
function pkg_version() {
	const NAME = 'luci-app-trafficctl';
	let pkg = null;
	for (let l in lib.file_lines('/usr/lib/opkg/status')) {
		let m = match(l, /^Package: *(.*)$/);
		if (m)
			pkg = m[1];
		else if (pkg == NAME && (m = match(l, /^Version: *(.+)$/)))
			return m[1];
	}
	pkg = null;
	for (let l in lib.file_lines('/lib/apk/db/installed')) {
		if (substr(l, 0, 2) == 'P:')
			pkg = substr(l, 2);
		else if (pkg == NAME && substr(l, 0, 2) == 'V:' && length(l) > 2)
			return substr(l, 2);
	}
	return 'dev';
}

// ── validators ──────────────────────────────────────────────────────────────

// Labels only become part of a log line; nothing but these characters.
function sanitize_label(s) {
	return replace(s, /[^a-zA-Z0-9_.-]/g, '');
}

// A history period id: 2026-11, 2026-11-11 or 2026-W46.
function period_id(s) {
	return s == '' || !!match(s, /^[0-9]{4}-([0-9]{2}|[0-9]{2}-[0-9]{2}|W[0-9]{2})$/);
}

// history.uc valid_dir: the store is a mkdir -p and a delete target, so only
// a directory below one of these roots, without shell metacharacters. Every
// component is a name: '/mnt/.', '/mnt//' or '/mnt/./x' would otherwise
// pass the prefix test and make the store a mount root.
function history_dir_ok(d) {
	if (!lib.plain(d))
		return false;
	if (substr(d, -1) == '/')
		d = substr(d, 0, -1);
	if (match(d, /['"$`|;&<>\x01-\x1f]/))
		return false;
	let parts = split(d, '/');
	for (let i = 1; i < length(parts); i++)
		if (parts[i] == '' || parts[i] == '.' || parts[i] == '..')
			return false;
	if (!match(d, /^\/(etc\/trafficctl|mnt|media|srv|tmp)\/./))
		return false;
	return true;
}

// ── methods ─────────────────────────────────────────────────────────────────

// The notify_telegram sender, once the bot's notification options moved
// there (`trafficctl notify migrate`); null before.
function tg_sender() {
	return filter(notify.senders(), (x) => x.type == 'telegram' && !x.legacy)[0];
}

// telegram_config_set's notification keys, written to that sender.
function tg_sender_set(x, a) {
	let c = lib.cursor(), ev = notify.events_of(x.s), any = false;
	for (let k in [ 'new_device', 'known_device' ]) {
		let v = arg(a, 'notify_' + k), keep = [];
		if (v == '')
			keep = ev;
		else {
			any = true;
			for (let e in ev)
				if (e != k)
					push(keep, e);
			if (v == 'true')
				push(keep, k);
		}
		ev = keep;
	}
	if (any) {
		if (length(ev))
			c.set('trafficctl', x.name, 'events', ev);
		c.set('trafficctl', x.name, 'enabled', length(ev) ? '1' : '0');
	}
	if (exists(a, 'notify_template')) {
		let tpl = arg(a, 'notify_template');
		if (tpl == '')
			c.delete('trafficctl', x.name, 'template');
		else
			c.set('trafficctl', x.name, 'template', tpl);
	}
}

function telegram_defaults() {
	return { enabled: false, bot_token: '', bot_token_set: false, chat_id: '', poll_interval: 3,
		notify_new_device: true, notify_known_device: false, control_enabled: true,
		notify_template: '', btn_block_inet: true, btn_block_wifi: true, btn_limiter: true,
		btn_shaper: true, bot_running: false };
}

function history_read(x, a, cmd) {
	let hp = arg(a, 'period'), ht = arg(a, 'to');
	if (!period_id(hp) || !period_id(ht))
		return { result: [] };
	return wrapped(x, [ 'history', cmd, hp, ht ]);
}

const methods = {
	summary: (x) => wrapped(x, [ 'summary' ]),

	device: (x, a) => {
		let ip = arg(a, 'ip'), proto = arg(a, 'proto');
		if (ip == '')
			return fail('ip required');
		let argv = (proto == 'tcp' || proto == 'udp') ? [ 'device', ip, '--proto', proto ] : [ 'device', ip ];
		return cli(x, [ ...argv, '--max-bytes', '' + DEVICE_MAX_BYTES ]);
	},

	// The accumulator, not the raw sampler: the lifetime totals the columns
	// show are added there, and this poll is what keeps them advancing.
	bytes: (x) => wrapped(x, [ 'totals' ]),

	ifaces: (x) => wrapped(x, [ 'ifaces' ]),

	block: (x, a) => {
		let ip = arg(a, 'ip');
		return (ip == '') ? fail('ip required') : cli(x, [ 'block', ip, sanitize_label(arg(a, 'label')) ]);
	},

	unblock: (x, a) => {
		let ip = arg(a, 'ip');
		return (ip == '') ? fail('ip required') : cli(x, [ 'unblock', ip, sanitize_label(arg(a, 'label')) ]);
	},

	macfilter_add: (x, a) => {
		let ip = arg(a, 'ip');
		return (ip == '') ? fail('ip required') : cli(x, [ 'macfilter-add', ip ]);
	},

	// The deny list is keyed on the MAC, and an offline device may have no
	// lease left to find it by IP, so the MAC wins.
	macfilter_remove: (x, a) => {
		let ip = arg(a, 'ip'), mac = arg(a, 'mac');
		if (ip == '' && mac == '')
			return fail('ip or mac required');
		return cli(x, [ 'macfilter-remove', (mac != '') ? mac : ip ]);
	},

	// An absent or zero upload rate means "same as download", not "no
	// upload": a zero ceiling would police every packet.
	ratelimit: (x, a) => {
		let ip = arg(a, 'ip'), rate = arg(a, 'rate_kbit'), mode = arg(a, 'mode'), up = arg(a, 'rate_kbit_up');
		if (mode != 'each' && mode != 'shared')
			mode = '';
		if (up == '0')
			up = '';
		if (ip == '')
			return fail('ip required');
		return cli(x, [ 'ratelimit', ip, (rate != '') ? rate : '0', sanitize_label(arg(a, 'label')), mode, up ]);
	},

	ratelimit_stats: (x) => wrapped(x, [ 'ratelimit-stats' ]),

	subnets: (x) => wrapped(x, [ 'subnets' ]),

	shape_add: (x, a) => {
		let ip = arg(a, 'ip'), rate = arg(a, 'rate_kbit'), up = arg(a, 'rate_kbit_up');
		if (up == '0')
			up = '';
		if (ip == '' || rate == '')
			return fail('ip and rate_kbit required');
		return cli(x, [ 'shape', 'add', ip, rate, sanitize_label(arg(a, 'label')), up ]);
	},

	shape_remove: (x, a) => {
		let ip = arg(a, 'ip');
		return (ip == '') ? fail('ip required') : cli(x, [ 'shape', 'remove', ip ]);
	},

	shape_status: (x, a) => {
		let ip = arg(a, 'ip');
		return (ip == '') ? fail('ip required') : cli(x, [ 'shape', 'status', ip ]);
	},

	shape_stats: (x) => wrapped(x, [ 'shape-stats' ]),

	// Every block, limit, shape and WiFi deny, online or not.
	rules_list: (x) => wrapped(x, [ 'rules', 'list' ]),

	rdns: (x, a) => {
		let ip = arg(a, 'ip');
		return (ip == '') ? fail('ip required') : cli(x, [ 'rdns', ip ]);
	},

	netify_status: (x) => cli(x, [ 'netify', 'status' ]),

	netify_list: (x) => wrapped(x, [ 'netify', 'list' ]),

	netify_collect: (x, a) => {
		// The UI never asks for a collection; 30 s spans two of the
		// aggregator's ~15 s reports and stays well inside the timeout.
		let secs = arg(a, 'secs');
		if (secs == '')
			secs = '3';
		else if (!digits(secs) || lib.valid_int(secs, 1, 30) == null)
			return fail('secs must be between 1 and 30');
		return cli(x, [ 'netify', 'collect', secs ]);
	},

	names_list: (x) => ({ result: lib.names_list() }),

	// An empty name forgets the alias, so the UI clears it by submitting a
	// blank field.
	name_set: (x, a) => {
		let ip = arg(a, 'ip'), name = arg(a, 'name');
		if (ip == '')
			return fail('ip required');
		return (name == '') ? lib.names_remove(ip) : lib.names_set(ip, name);
	},

	name_clear: (x, a) => {
		let ip = arg(a, 'ip');
		return (ip == '') ? fail('ip required') : lib.names_remove(ip);
	},

	portfw_list: (x) => wrapped(x, [ 'portfw', 'list' ]),

	portfw_ctl: (x, a) => {
		let action = arg(a, 'action'), ip = arg(a, 'ip');
		let target = [ arg(a, 'scope'), arg(a, 'proto'), (ip != '') ? ip : '-', arg(a, 'port') ];
		if (action == 'pause' || action == 'resume')
			return cli(x, [ 'portfw', action, ...target ]);
		if (action == 'limit') {
			let rate = arg(a, 'rate_kbit');
			return cli(x, [ 'portfw', 'limit', ...target, (rate != '') ? rate : '0' ]);
		}
		return fail('action must be pause, resume or limit');
	},

	// A counter flowtable keeps conntrack accounting right
	// (tctl_get_offload_mode); only nft can tell, so it is asked through
	// file.exec, and only when offload is on.
	config_get: (x) => {
		let hw = fw_get('flow_offloading_hw') == '1', sw = fw_get('flow_offloading') == '1';
		let r = {
			enabled: uget('main', 'enabled') == '1',
			default_mode: uget('main', 'default_mode') || 'limiter',
			offload_mode: 'none',
			nss: lib.nss_status(),
			sw: sw,
			hw: hw,
			poll_interval: num(uget('main', 'poll_interval'), 2),
			avg_window: num(uget('main', 'avg_window'), 15),
		};
		if (!hw && !sw)
			return r;
		let mode = hw ? 'hardware' : 'software';
		return chain(x, 'file', 'exec', { command: lib.path('/usr/sbin/nft'), params: [ 'list', 'flowtables' ] }, (rc, out) => {
			r.offload_mode = (rc == 0 && index(out?.stdout ?? '', 'counter') >= 0) ? mode + '-counter' : mode;
			return r;
		});
	},

	config_set: (x, a) => {
		let enabled = arg(a, 'enabled'), mode = arg(a, 'default_mode'), sw = arg(a, 'sw'), hw = arg(a, 'hw');
		let poll = arg(a, 'poll_interval'), win = arg(a, 'avg_window');
		// 0 is "do not poll"; below a second the browser cannot keep up, and
		// every tick costs the router a conntrack read.
		if (poll != '') {
			if (!digits(poll))
				return fail('poll_interval must be a number');
			let n = lib.valid_int(poll);
			if (poll != '0' && (n == null || n < 1 || n > 300))
				return fail('poll_interval must be 0 (off) or between 1 and 300 seconds');
		}
		// The window sizes the per-device sample history in every browser.
		if (win != '') {
			if (!digits(win))
				return fail('avg_window must be a number');
			if (lib.valid_int(win, 2, 3600) == null)
				return fail('avg_window must be between 2 and 3600 seconds');
		}
		if (enabled != '')
			uset('main', 'enabled', bool01(enabled));
		if (mode != '')
			uset('main', 'default_mode', mode);
		if (poll != '')
			uset('main', 'poll_interval', poll);
		if (win != '')
			uset('main', 'avg_window', win);
		let err = save('trafficctl');
		if (err)
			return err;
		let fw = fw_defaults();
		if ((sw != '' || hw != '') && fw != null) {
			let c = lib.cursor();
			if (sw != '')
				c.set('firewall', fw, 'flow_offloading', bool01(sw));
			if (hw != '')
				c.set('firewall', fw, 'flow_offloading_hw', bool01(hw));
			if ((err = save('firewall')))
				return err;
			init_script('firewall', [ 'reload' ]);
		}
		return OK;
	},

	telegram_config_get: (x) => {
		if (lib.cursor().get('trafficctl', 'telegram') == null)
			return telegram_defaults();
		let t = (o) => uget('telegram', o);
		let on = (o) => (t(o) ?? '1') != '0';
		let token = t('bot_token') ?? '';
		let r = {
			enabled: t('enabled') == '1',
			// Never the token itself: the UI shows a mask and sends it back.
			bot_token: (token != '') ? '***' : '',
			bot_token_set: token != '',
			chat_id: t('chat_id') ?? '',
			poll_interval: num(t('poll_interval'), 3),
			notify_new_device: on('notify_new_device'),
			notify_known_device: t('notify_known_device') == '1',
			control_enabled: on('control_enabled'),
			notify_template: t('notify_template') ?? '',
			btn_block_inet: on('btn_block_inet'),
			btn_block_wifi: on('btn_block_wifi'),
			btn_limiter: on('btn_limiter'),
			btn_shaper: on('btn_shaper'),
			bot_running: bot_running(),
		};
		// Since 1.31 the notification options belong to the notify_telegram
		// sender (the Notifications tab); the old keys read it back.
		let snd = tg_sender();
		if (snd) {
			let ev = notify.events_of(snd.s), on_ = (snd.s.enabled ?? '1') == '1';
			r.notify_new_device = on_ && index(ev, 'new_device') >= 0;
			r.notify_known_device = on_ && index(ev, 'known_device') >= 0;
			r.notify_template = snd.s.template ?? '';
		}
		return r;
	},

	telegram_config_set: (x, a) => {
		ensure_section('telegram');
		let snd = tg_sender();
		if (snd)
			tg_sender_set(snd, a);
		let v = arg(a, 'enabled');
		if (v != '')
			uset('telegram', 'enabled', bool01(v));
		// The mask the getter hands out is not a token.
		v = arg(a, 'bot_token');
		if (v != '***')
			uset('telegram', 'bot_token', v);
		for (let o in [ 'chat_id', 'poll_interval' ]) {
			v = arg(a, o);
			if (v != '')
				uset('telegram', o, v);
		}
		if (!snd)
			uset('telegram', 'notify_template', arg(a, 'notify_template'));
		for (let o in [ 'notify_new_device', 'notify_known_device', 'control_enabled', 'btn_block_inet',
		                'btn_block_wifi', 'btn_limiter', 'btn_shaper' ]) {
			v = arg(a, o);
			if (v != '' && (!snd || substr(o, 0, 7) != 'notify_'))
				uset('telegram', o, bool01(v));
		}
		let err = save('trafficctl');
		if (err)
			return err;
		lib.log('telegram_config_change', '', '', 'luci', x.who.src);
		// Boot starts only what rc.d enables, so rc.d follows the flag: a
		// reload alone left a bot switched on here gone after the next reboot.
		init_script('trafficctl-telegram',
			[ (uget('telegram', 'enabled') == '1') ? 'enable' : 'disable', 'reload' ]);
		return OK;
	},

	// The token reaches the command in its environment (TCTL_TG_TOKEN),
	// never in an argument list; the CLI's one curl gives up after 10 s.
	telegram_test: (x, a) => {
		let token = arg(a, 'bot_token'), chat = arg(a, 'chat_id');
		if (token == '***' || token == '')
			token = uget('telegram', 'bot_token') ?? '';
		if (token == '' || chat == '')
			return fail('token and chat_id required');
		return cli(x, [ 'telegram-test', '-', chat, arg(a, 'message') ], { TCTL_TG_TOKEN: token });
	},

	// ── notifications ──
	notify_config_get: (x) => notify.config_get(),

	// One sender (sender: a type or a section name) or, with no sender, the
	// global options. The bot's old options move first, so the tab never
	// edits a sender that a later migration would overwrite.
	notify_config_set: (x, a) => {
		notify.migrate();
		let o = {};
		for (let k in keys(SIGNATURES.notify_config_set))
			if (exists(a, k) && a[k] != null)
				o[k] = arg(a, k);
		let r = notify.config_set(o);
		if (!r.ok) {
			lib.cursor().revert('trafficctl');
			return r;
		}
		let err = save('trafficctl');
		if (err)
			return err;
		lib.log('notify_config_change', r.sender ?? 'notify', '', 'luci', x.who.src);
		init_script('trafficctl-notify', [ 'enable', 'restart' ]);
		return OK;
	},

	notify_test: (x, a) => run_cli(x, [ 'notify', 'test', arg(a, 'sender') ], null, (err, out) => {
		if (err)
			return fail(err);
		lib.reset();
		lib.set_context(x.who);
		lib.log('notify_test', arg(a, 'sender'), '', 'luci', x.who.src);
		return parse_reply(out);
	}),
	// ── end notifications ──

	logging_config_get: (x) => {
		let l = (o) => uget('logging', o);
		let on = (o) => (l(o) ?? '1') != '0';
		return {
			enabled: (l('enabled') || '1') == '1',
			log_file: l('log_file') || '/tmp/trafficctl/activity.log',
			max_lines: num(l('max_lines'), 500),
			syslog: (l('syslog') || '1') == '1',
			log_blocks: on('log_blocks'),
			log_ratelimits: on('log_ratelimits'),
			log_shapes: on('log_shapes'),
			log_telegram: on('log_telegram'),
			log_config: on('log_config'),
			persist_rules: uget('main', 'persist_rules') == '1',
		};
	},

	logging_config_set: (x, a) => {
		let file = arg(a, 'log_file'), max = arg(a, 'max_lines'), persist = arg(a, 'persist_rules');
		// Both an append and a rotation target, reachable from the write ACL.
		if (file != '' && !lib.valid_log_file(file))
			return fail('log_file must be under /tmp/trafficctl/ or /var/log/');
		if (max != '') {
			if (!digits(max))
				return fail('max_lines must be a number');
			// Rotation keeps 3/5 of the cap; below 20 that rounds towards zero.
			if (lib.valid_int(max, 20, 100000) == null)
				return fail('max_lines must be between 20 and 100000');
		}
		ensure_section('logging');
		for (let o in [ 'enabled', 'syslog', 'log_blocks', 'log_ratelimits', 'log_shapes', 'log_telegram', 'log_config' ]) {
			let v = arg(a, o);
			if (v != '')
				uset('logging', o, bool01(v));
		}
		if (file != '')
			uset('logging', 'log_file', file);
		if (max != '')
			uset('logging', 'max_lines', max);
		if (persist != '')
			uset('main', 'persist_rules', bool01(persist));
		let err = save('trafficctl');
		if (err)
			return err;
		lib.log('config_change', 'logging', '', 'luci', x.who.src);
		return OK;
	},

	// seen_count lets the UI tell "the ledger knows my 23 devices" from "the
	// ledger is empty and everything is about to look new".
	newdevice_config_get: (x) => ({
		enabled: uget('newdevice', 'enabled') == '1',
		limit_kbit: num(uget('newdevice', 'limit_kbit'), 0),
		limit_mode: uget('newdevice', 'limit_mode') || 'limiter',
		seen_count: lib.seen_count(),
		seeded: lib.seen_ready(),
	}),

	newdevice_config_set: (x, a) => {
		let kbit = arg(a, 'limit_kbit'), mode = arg(a, 'limit_mode'), enabled = arg(a, 'enabled');
		if (kbit != '' && !digits(kbit))
			return fail('limit_kbit must be a number');
		if (mode != '' && mode != 'limiter' && mode != 'shaper')
			return fail('limit_mode must be limiter or shaper');
		ensure_section('newdevice');
		if (kbit != '')
			uset('newdevice', 'limit_kbit', kbit);
		if (mode != '')
			uset('newdevice', 'limit_mode', mode);
		if (enabled != '') {
			// Seed the ledger before the feature can fire, on an operator's
			// action, when the leases and the neighbour table are populated:
			// seeding at boot would record an empty LAN.
			if (enabled == 'true')
				lib.seen_seed();
			uset('newdevice', 'enabled', bool01(enabled));
		}
		let err = save('trafficctl');
		if (err)
			return err;
		lib.log('config_change', 'newdevice', '', 'luci', x.who.src);
		return OK;
	},

	// A write method: it enforces the auto-revert deadline and restarts a
	// dead keeper, so the UI never reports a lapsed cut as on.
	cut_status: (x) => cli(x, [ 'cut', 'status' ]),

	cut_set: (x, a) => {
		let active = arg(a, 'active'), duration = arg(a, 'duration');
		if (active == 'true') {
			if (!digits(duration))
				return fail('duration must be a number of seconds (0 = indefinite)');
			let pflag = (arg(a, 'persist') == 'true') ? '1' : '0';
			// Preferences only, so the control comes back as it was left. The
			// engaged state never goes to uci: /etc/config survives a reboot.
			ensure_section('cut');
			uset('cut', 'default_duration', duration);
			uset('cut', 'persist', pflag);
			// Nothing is engaged on a config that cannot be written: the
			// reply would say the cut is on with its settings unsaved.
			let err = save('trafficctl');
			if (err)
				return err;
			return cli(x, [ 'cut', 'engage', duration, pflag ]);
		}
		if (active == 'false')
			return cli(x, [ 'cut', 'release' ]);
		return fail('active must be true or false');
	},

	activity_log: (x, a) => {
		let n = arg(a, 'lines');
		n = (n == '') ? 50 : digits(n) ? (lib.valid_int(n, 0, 1000) ?? 1000) : 50;
		let file = uget('logging', 'log_file');
		if (file == null || !lib.valid_log_file(file))
			file = '/tmp/trafficctl/activity.log';
		if (!lib.is_file(file))
			return { ok: true, lines: [] };
		return { ok: true, lines: lib.tail_lines(file, n) };
	},

	history_status: (x) => wrapped(x, [ 'history', 'status' ]),

	history_periods: (x) => wrapped(x, [ 'history', 'periods' ]),

	// Period ids never reach a path, but they come from the network: a
	// malformed one gets an empty answer rather than silently matching nothing.
	history_read: (x, a) => history_read(x, a, 'read'),

	history_read_ifaces: (x, a) => history_read(x, a, 'read-ifaces'),

	history_config_get: (x) => wrapped(x, [ 'history', 'status' ]),

	history_config_set: (x, a) => {
		let dir = arg(a, 'dir'), period = arg(a, 'period');
		if (dir != '' && !history_dir_ok(dir))
			return fail('dir must be under /etc/trafficctl, /mnt, /media, /srv or /tmp');
		if (period != '' && period != 'day' && period != 'week' && period != 'month')
			return fail('period must be day, week or month');
		for (let k in [ 'interval', 'sample_interval', 'keep' ]) {
			let v = arg(a, k);
			if (v != '' && !digits(v))
				return fail(k + ' must be a number');
		}
		ensure_section('history');
		if (dir != '')
			uset('history', 'dir', dir);
		if (period != '')
			uset('history', 'period', period);
		for (let k in [ 'interval', 'sample_interval', 'keep' ]) {
			let v = arg(a, k);
			if (v != '')
				uset('history', k, v);
		}
		for (let k in [ 'enabled', 'interfaces' ]) {
			let v = arg(a, k);
			if (v != '')
				uset('history', k, bool01(v));
		}
		let err = save('trafficctl');
		if (err)
			return err;
		// The keeper re-reads its settings every tick, but it has to be
		// running: switching history on must not wait for a reboot.
		init_script('trafficctl-history',
			(uget('history', 'enabled') == '1') ? [ 'enable', 'start' ] : [ 'stop' ]);
		lib.log('config_change', 'history', '', 'luci', x.who.src);
		return OK;
	},

	// "Flush now": it writes to durable storage, so a write method.
	history_flush: (x) => wrapped(x, [ 'history', 'flush' ]),

	version: (x) => ({ version: pkg_version() }),
};

// ── main ────────────────────────────────────────────────────────────────────

// Runs the method for a caller now known; an exception is the method's
// error reply, as from the exec plugin.
function run(x, a) {
	lib.reset();
	lib.set_context(x.who);
	try {
		return methods[x.method](x, a);
	}
	catch (e) {
		return internal_error(x, e);
	}
}

// uhttpd adds the caller's session to every call, and rpcd hands it on in
// the arguments. A method that logs or changes something asks the session
// who that is, as a deferred call: rpcd serves session itself.
function handle(method, req) {
	let a = req.args ?? {}, sid = arg(a, 'ubus_rpc_session');
	let x = { req: req, method: method, who: caller(null) };
	if (READ_ONLY[method] || !match(sid, /^[0-9a-f]{32}$/))
		return run(x, a);
	return chain(x, 'session', 'get', { ubus_rpc_session: sid }, (rc, r) => {
		x.who = caller((rc == 0) ? r?.values : null);
		return run(x, a);
	});
}

// The value rpcd takes from call(): an object is the reply, a deferred call
// replies later, and a status is sent here.
function call_method(method, req) {
	let v = handle(method, req);
	if (type(v) == 'int') {
		send({ req: req, method: method }, v);
		return null;
	}
	return v;
}

const TYPE_HINT = { str: '', int: 0, bool: false };

function signature() {
	let sig = {};
	for (let name, args in SIGNATURES) {
		let hints = {};
		for (let k, t in args)
			hints[k] = TYPE_HINT[t];
		sig[name] = { args: hints, call: ((m) => (req) => call_method(m, req))(name) };
	}
	return sig;
}

return { 'luci.trafficctl': signature() };
