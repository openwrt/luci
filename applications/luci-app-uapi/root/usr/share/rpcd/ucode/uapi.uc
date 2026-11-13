#!/usr/bin/env ucode

'use strict';

import { popen, stat, readfile, writefile, unlink, open } from 'fs';
import { cursor } from 'uci';

const TOKEN_CLI = '/usr/bin/uapi-token';
const HANDLER = '/usr/share/uapi/main.uc';
const OPENAPI = '/usr/share/uapi/openapi.json';
const INSECURE_MARKER = '/etc/uapi.insecure';
// uapi mounts one API major per installation and the prefix tracks it
// (/api/v2 for uapi 2.x, /api/v3 for 3.x), so match the major rather than a
// literal string: this reports the actual mount instead of breaking on upgrade.
const PREFIX_RE = /^\/api\/(v[0-9]+)=\/usr\/share\/uapi\/main\.uc$/;
const NAME_RE = /^[A-Za-z0-9_]+$/;

function shellquote(s) {
	return "'" + replace(`${s}`, "'", "'\\''") + "'";
}

function as_list(v) {
	if (v == null) return [];
	if (type(v) == 'array') return v;
	return [ v ];
}

function random_hex() {
	const f = open('/dev/urandom', 'r');
	if (!f) return null;
	const raw = f.read(8);
	f.close();
	let hex = '';
	for (let i = 0; i < length(raw); i++)
		hex += sprintf('%02x', ord(raw, i));
	return hex;
}

// Run the uapi-token CLI, capturing stdout and stderr separately. The stderr
// file gets an unpredictable name because root opens it via the shell redirect:
// a guessable path would let a local user pre-plant a symlink for root to
// clobber, and would also collide between concurrent calls.
function run_cli(cmd) {
	const errfile = `/tmp/.luci-uapi.${random_hex() ?? time()}`;
	const fd = popen(`${cmd} 2>${shellquote(errfile)}`);
	if (!fd)
		return { code: -1, out: '', err: 'Failed to launch uapi-token' };
	const out = trim(fd.read('all'));
	const code = fd.close();
	const err = trim(readfile(errfile) ?? '');
	unlink(errfile);
	return { code, out, err };
}

// uhttpd forwards a hard-coded header allowlist to mod-ucode handlers, so we
// cannot read the running version over HTTP without a token. The shipped spec
// is the authoritative local copy of the contract version.
function read_version() {
	const raw = readfile(OPENAPI);
	if (!raw) return null;
	try {
		const spec = json(raw);
		return spec?.info?.version;
	} catch (e) {
		return null;
	}
}

function prefix_entries(uci) {
	return as_list(uci.get('uhttpd', 'main', 'ucode_prefix'));
}

function token_sections(uci) {
	const tokens = [];
	const now = time();
	uci.foreach('uapi', 'token', (s) => {
		const expires_at = s.expires_at ? +s.expires_at : null;
		push(tokens, {
			name: s['.name'],
			scopes: as_list(s.scopes),
			expires_at,
			expired: (expires_at != null) ? (expires_at <= now) : false,
			allowed_cidrs: as_list(s.allowed_cidrs),
			last_used_at: s.last_used_at ? +s.last_used_at : null,
			last_used_ip: s.last_used_ip ?? null,
			rate: s.rate ? +s.rate : null,
			burst: s.burst ? +s.burst : null
		});
	});
	return tokens;
}

const methods = {
	get_status: {
		call: function() {
			const uci = cursor();
			const entries = prefix_entries(uci);
			let api_major = null;
			for (let e in entries) {
				const m = match(e, PREFIX_RE);
				if (m) { api_major = m[1]; break; }
			}
			const result = {
				installed: !!stat(HANDLER),
				version: read_version(),
				wired: (api_major != null),
				api_major,
				prefix_entries: entries,
				token_count: length(token_sections(uci)),
				insecure: !!stat(INSECURE_MARKER),
				https_listen: as_list(uci.get('uhttpd', 'main', 'listen_https'))
			};
			uci.unload('uhttpd');
			uci.unload('uapi');
			return result;
		}
	},

	list_tokens: {
		call: function() {
			const uci = cursor();
			const tokens = token_sections(uci);
			uci.unload('uapi');
			return { tokens };
		}
	},

	// Authoritative scope list from the uapi-token CLI (uapi 2.3.0+, see
	// openwrt-iac/uapi#5): `uapi-token scopes` prints one scope path per line.
	// On older uapi the subcommand is unknown and exits non-zero, so we return
	// empty and the token form falls back to a free-text scope field. No source
	// parsing.
	list_scopes: {
		call: function() {
			const fd = popen(`${TOKEN_CLI} scopes 2>/dev/null`);
			if (!fd) return { scopes: [] };
			const out = fd.read('all');
			const code = fd.close();
			if (code != 0) return { scopes: [] };
			const scopes = [];
			for (let line in split(out, '\n')) {
				const s = trim(line);
				if (length(s)) push(scopes, s);
			}
			return { scopes };
		}
	},

	create_token: {
		args: {
			name: 'string',
			scopes: [],
			expires_in_seconds: 0,
			allowed_cidrs: [],
			rate: 0,
			burst: 0,
			force: false
		},
		call: function(req) {
			const name = req.args?.name;
			const scopes = filter(as_list(req.args?.scopes), (s) => length(`${s}`) > 0);
			const cidrs = filter(as_list(req.args?.allowed_cidrs), (c) => length(`${c}`) > 0);
			const expires = +req.args?.expires_in_seconds;
			// Per-token rate limit (uapi 3.0.0+). Omitted when unset, so the
			// request stays valid against an older CLI that lacks the flags.
			const rate = +req.args?.rate;
			const burst = +req.args?.burst;

			if (!name || !match(name, NAME_RE))
				return { error: 'Invalid name: must match [A-Za-z0-9_]+ (use underscores, not hyphens)' };
			if (!length(scopes))
				return { error: 'At least one scope is required' };

			let cmd = `${TOKEN_CLI} create --name ${shellquote(name)}`;
			for (let s in scopes) cmd += ` --scope ${shellquote(s)}`;
			for (let c in cidrs) cmd += ` --allowed-cidr ${shellquote(c)}`;
			if (expires > 0) cmd += ` --expires-in ${shellquote(expires)}`;
			if (rate > 0) cmd += ` --rate ${shellquote(rate)}`;
			if (burst > 0) cmd += ` --burst ${shellquote(burst)}`;
			if (req.args?.force) cmd += ' --force';

			const r = run_cli(cmd);
			if (r.code != 0 || !length(r.out))
				return { error: length(r.err) ? r.err : `uapi-token exited ${r.code}` };

			return { bearer: r.out, name };
		}
	},

	revoke_token: {
		args: { name: 'string' },
		call: function(req) {
			const name = req.args?.name;
			if (!name || !match(name, NAME_RE))
				return { error: 'Invalid token name' };

			const r = run_cli(`${TOKEN_CLI} revoke ${shellquote(name)}`);
			if (r.code != 0)
				return { error: length(r.err) ? r.err : `uapi-token exited ${r.code}` };
			return { result: 'OK' };
		}
	},

	set_insecure: {
		args: { enable: false },
		call: function(req) {
			if (req.args?.enable) {
				if (writefile(INSECURE_MARKER, '') == null)
					return { error: `Cannot create ${INSECURE_MARKER}` };
			} else {
				unlink(INSECURE_MARKER);
				if (stat(INSECURE_MARKER))
					return { error: `Cannot remove ${INSECURE_MARKER}` };
			}
			return { result: 'OK', insecure: !!stat(INSECURE_MARKER) };
		}
	}
};

return { 'luci.uapi': methods };
