// Copyright 2022 Jo-Philipp Wich <jo@mein.io>
// Licensed to the public under the Apache License 2.0.

import { open, stat, glob, lsdir, unlink, basename } from 'fs';
import { striptags, entityencode } from 'html';
import { connect } from 'ubus';
import { cursor } from 'uci';
import { rand } from 'math';

import { hash, load_catalog, change_catalog, translate, ntranslate, getuid } from 'luci.core';
import { revision as luciversion, branch as luciname } from 'luci.version';
import { default as LuCIRuntime } from 'luci.runtime';
import { urldecode } from 'luci.http';

let ubus = connect();
let uci = cursor();

let indexcache = "/tmp/luci-indexcache";

let http, runtime, tree, luabridge;

function error404(msg) {
	http.status(404, 'Not Found');

	try {
		runtime.render('error404', { message: msg ?? 'Not found' });
	}
	catch {
		http.header('Content-Type', 'text/plain; charset=UTF-8');
		http.write(msg ?? 'Not found');
	}

	return false;
}

function error500(msg, ex) {
	if (!http.eoh) {
		http.status(500, 'Internal Server Error');
		http.header('Content-Type', 'text/html; charset=UTF-8');
	}

	try {
		runtime.render('error500', {
			title: ex?.type ?? 'Runtime exception',
			message: replace(
				msg,
				/(\s)((\/[A-Za-z0-9_.-]+)+:\d+|\[string "[^"]+"\]:\d+)/g,
				'$1<code>$2</code>'
			),
			exception: ex
		});
	}
	catch {
		http.write('<!--]]>--><!--\'>--><!--">-->\n');
		http.write(`<p>${trim(msg)}</p>\n`);

		if (ex) {
			http.write(`<p>${trim(ex.message)}</p>\n`);
			http.write(`<pre>${trim(ex.stacktrace[0].context)}</pre>\n`);
		}
	}

	exit(0);
}

function load_luabridge(optional) {
	if (luabridge == null) {
		try {
			luabridge = require('lua');
		}
		catch (ex) {
			luabridge = false;

			if (!optional)
				error500('No Lua runtime installed');
		}
	}

	return luabridge;
}

function determine_request_language() {
	let lang = uci.get('luci', 'main', 'lang') || 'auto';

	if (lang == 'auto') {
		for (let tag in split(http.getenv('HTTP_ACCEPT_LANGUAGE'), ',')) {
			tag = split(trim(split(tag, ';')?.[0]), '-');

			if (tag) {
				let cc = tag[1] ? `${tag[0]}_${lc(tag[1])}` : null;

				if (cc && uci.get('luci', 'languages', cc)) {
					lang = cc;
					break;
				}
				else if (uci.get('luci', 'languages', tag[0])) {
					lang = tag[0];
					break;
				}
			}
		}
	}

	if (lang == 'auto')
		lang = 'en';
	else
		lang = replace(lang, '_', '-');

	if (load_catalog(lang, '/usr/lib/lua/luci/i18n'))
		change_catalog(lang);

	return lang;
}

function determine_version() {
	let res = { luciname, luciversion };

	for (let f = open("/etc/os-release"), l = f?.read?.("line"); l; l = f.read?.("line")) {
		let kv = split(l, '=', 2);

		switch (kv[0]) {
		case 'NAME':
			res.distname = trim(kv[1], '"\' \n');
			break;

		case 'VERSION':
			res.distversion = trim(kv[1], '"\' \n');
			break;

		case 'HOME_URL':
			res.disturl = trim(kv[1], '"\' \n');
			break;

		case 'BUILD_ID':
			res.distrevision = trim(kv[1], '"\' \n');
			break;
		}
	}

	return res;
}

function read_jsonfile(path, defval) {
	let rv;

	try {
		rv = json(open(path, "r"));
	}
	catch (e) {
		rv = defval;
	}

	return rv;
}

function read_cachefile(file, reader) {
	let euid = getuid(),
	    fstat = stat(file),
	    fuid = fstat?.uid,
	    perm = fstat?.perm;

	if (euid != fuid ||
	    perm?.group_read || perm?.group_write || perm?.group_exec ||
	    perm?.other_read || perm?.other_write || perm?.other_exec)
	    return null;

	return reader(file);
}

function check_fs_depends(spec) {
	for (let path, kind in spec) {
		if (kind == 'directory') {
			if (!length(lsdir(path)))
				return false;
		}
		else if (kind == 'executable') {
			let fstat = stat(path);

			if (fstat?.type != 'file' || fstat?.user_exec == false)
				return false;
		}
		else if (kind == 'file') {
			let fstat = stat(path);

			if (fstat?.type != 'file')
				return false;
		}
		else if (kind == 'absent') {
			if (stat(path) != null)
				return false;
		}
	}

	return true;
}

function check_uci_depends_options(conf, s, opts) {
	if (type(opts) == 'string') {
		return (s['.type'] == opts);
	}
	else if (opts === true) {
		for (let option, value in s)
			if (ord(option) != 46)
				return true;
	}
	else if (type(opts) == 'object') {
		for (let option, value in opts) {
			let sval = s[option];

			if (type(sval) == 'array') {
				if (!(value in sval))
					return false;
			}
			else if (value === true) {
				if (sval == null)
					return false;
			}
			else {
				if (sval != value)
					return false;
			}
		}
	}

	return true;
}

function check_uci_depends_section(conf, sect) {
	for (let section, options in sect) {
		let stype = match(section, /^@([A-Za-z0-9_-]+)$/);

		if (stype) {
			let found = false;

			uci.load(conf);
			uci.foreach(conf, stype[1], (s) => {
				if (check_uci_depends_options(conf, s, options)) {
					found = true;
					return false;
				}
			});

			if (!found)
				return false;
		}
		else {
			let s = uci.get_all(conf, section);

			if (!s || !check_uci_depends_options(conf, s, options))
				return false;
		}
	}

	return true;
}

function check_uci_depends(conf) {
	for (let config, values in conf) {
		if (values == true) {
			let found = false;

			uci.load(config);
			uci.foreach(config, null, () => { found = true });

			if (!found)
				return false;
		}
		else if (type(values) == 'object') {
			if (!check_uci_depends_section(config, values))
				return false;
		}
	}

	return true;
}

function check_depends(spec) {
	if (type(spec?.depends?.fs) in ['array', 'object']) {
		let satisfied = false;
		let alternatives = (type(spec.depends.fs) == 'array') ? spec.depends.fs : [ spec.depends.fs ];

		for (let alternative in alternatives) {
			if (check_fs_depends(alternative)) {
				satisfied = true;
				break;
			}
		}

		if (!satisfied)
			return false;
	}

	if (type(spec?.depends?.uci) in ['array', 'object']) {
		let satisfied = false;
		let alternatives = (type(spec.depends.uci) == 'array') ? spec.depends.uci : [ spec.depends.uci ];

		for (let alternative in alternatives) {
			if (check_uci_depends(alternative)) {
				satisfied = true;
				break;
			}
		}

		if (!satisfied)
			return false;
	}

	return true;
}

function check_acl_depends(require_groups, groups) {
	if (length(require_groups)) {
		let writable = false;

		for (let group in require_groups) {
			let read = ('read' in groups?.[group]);
			let write = ('write' in groups?.[group]);

			if (!read && !write)
				return null;

			if (write)
				writable = true;
		}

		return writable;
	}

	return true;
}

function hash_filelist(files) {
	let hashval = 0x1b756362;

	for (let file in files) {
		let st = stat(file);

		if (st)
			hashval = hash(sprintf("%x|%x|%x", st.ino, st.mtime, st.size), hashval);
	}

	return hashval;
}

function build_pagetree() {
	let tree = { action: { type: 'firstchild' } };

	let schema = {
		action: 'object',
		auth: 'object',
		cors: 'bool',
		depends: 'object',
		order: 'int',
		setgroup: 'string',
		setuser: 'string',
		title: 'string',
		wildcard: 'bool',
		firstchild_ineligible: 'bool'
	};

	let files = glob('/usr/share/luci/menu.d/*.json', '/usr/lib/lua/luci/controller/*.lua', '/usr/lib/lua/luci/controller/*/*.lua');
	let cachefile;

	if (indexcache) {
		cachefile = sprintf('%s.%08x.json', indexcache, hash_filelist(files));

		let res = read_cachefile(cachefile, read_jsonfile);

		if (res)
			return res;

		for (let path in glob(indexcache + '.*.json'))
			unlink(path);
	}

	for (let file in files) {
		let data;

		if (substr(file, -5) == '.json')
			data = read_jsonfile(file);
		else if (load_luabridge(true))
			data = runtime.call('luci.dispatcher', 'process_lua_controller', file);
		else
			warn(`Lua controller ${file} present but no Lua runtime installed.\n`);

		if (type(data) == 'object') {
			for (let path, spec in data) {
				if (type(spec) == 'object') {
					let node = tree;

					for (let s in match(path, /[^\/]+/g)) {
						if (s[0] == '*') {
							node.wildcard = true;
							break;
						}

						node.children ??= {};
						node.children[s[0]] ??= { satisfied: true };
						node = node.children[s[0]];
					}

					if (node !== tree) {
						for (let k, t in schema)
							if (type(spec[k]) == t)
								node[k] = spec[k];

						node.satisfied = check_depends(spec);
					}
				}
			}
		}
	}

	if (cachefile) {
		let fd = open(cachefile, 'w', 0600);

		if (fd) {
			fd.write(tree);
			fd.close();
		}
	}

	return tree;
}

function apply_tree_acls(node, acl) {
	for (let name, spec in node?.children)
		apply_tree_acls(spec, acl);

	if (node?.depends?.acl) {
		switch (check_acl_depends(node.depends.acl, acl["access-group"])) {
		case null:  node.satisfied = false; break;
		case false: node.readonly = true;   break;
		}
	}
}

function menu_json(acl) {
	tree ??= build_pagetree();

	if (acl)
		apply_tree_acls(tree, acl);

	return tree;
}

function ctx_append(ctx, name, node) {
	ctx.path ??= [];
	push(ctx.path, name);

	ctx.acls ??= [];
	push(ctx.acls, ...(node?.depends?.acl || []));

	ctx.auth = node.auth || ctx.auth;
	ctx.cors = node.cors || ctx.cors;
	ctx.suid = node.setuser || ctx.suid;
	ctx.sgid = node.setgroup || ctx.sgid;

	return ctx;
}

function session_retrieve(sid, allowed_users) {
	let sdat = ubus.call("session", "get", { ubus_rpc_session: sid });
	let sacl = ubus.call("session", "access", { ubus_rpc_session: sid });

	if (type(sdat?.values?.token) == 'string' &&
	    (!length(allowed_users) || sdat?.values?.username in allowed_users)) {
		// uci:set_session_id(sid)
		return {
			sid,
			data: sdat.values,
			acls: length(sacl) ? sacl : {}
		};
	}

	return null;
}

function randomid(num_bytes) {
	let bytes = [];

	while (num_bytes-- > 0)
		push(bytes, sprintf('%02x', rand() % 256));

	return join('', bytes);
}

function syslog(prio, msg) {
	warn(sprintf("[%s] %s\n", prio, msg));
}

function session_setup(user, pass, path) {
	let timeout = uci.get('luci', 'sauth', 'sessiontime');
	let login = ubus.call("session", "login", {
		username: user,
		password: pass,
		timeout:  timeout ? +timeout : null
	});

	if (type(login?.ubus_rpc_session) == 'string') {
		ubus.call("session", "set", {
			ubus_rpc_session: login.ubus_rpc_session,
			values: { token: randomid(16) }
		});
		syslog("info", sprintf("luci: accepted login on /%s for %s from %s",
			join('/', path), user || "?", http.getenv("REMOTE_ADDR") || "?"));

		return session_retrieve(login.ubus_rpc_session);
	}

	syslog("info", sprintf("luci: failed login on /%s for %s from %s",
		join('/', path), user || "?", http.getenv("REMOTE_ADDR") || "?"));
}

function check_authentication(method) {
	let m = match(method, /^([[:alpha:]]+):(.+)$/);
	let sid;

	switch (m?.[1]) {
	case 'cookie':
		sid = http.getcookie(m[2]);
		break;

	case 'param':
		sid = http.formvalue(m[2]);
		break;

	case 'query':
		sid = http.formvalue(m[2], true);
		break;
	}

	return sid ? session_retrieve(sid) : null;
}

function is_authenticated(auth) {
	for (let method in auth?.methods) {
		let session = check_authentication(method);

		if (session)
			return session;
	}

	return null;
}

function node_weight(node) {
	let weight = min(node.order ?? 9999, 9999);

	if (node.auth?.login)
		weight += 10000;

	return weight;
}

function clone(src) {
	switch (type(src)) {
	case 'array':
		return map(src, clone);

	case 'object':
		let dest = {};

		for (let k, v in src)
			dest[k] = clone(v);

		return dest;

	default:
		return src;
	}
}

function resolve_firstchild(node, session, login_allowed, ctx) {
	let candidate, candidate_ctx;

	for (let name, child in node.children) {
		if (!child.satisfied)
			continue;

		if (!session)
			session = is_authenticated(node.auth);

		let cacl = child.depends?.acl;
		let login = login_allowed || child.auth?.login;

		if (login || check_acl_depends(cacl, session?.acls?.["access-group"]) != null) {
			if (child.title && type(child.action) == "object") {
				let child_ctx = ctx_append(clone(ctx), name, child);
				if (child.action.type == "firstchild") {
					if (!candidate || node_weight(candidate) > node_weight(child)) {
						let have_grandchild = resolve_firstchild(child, session, login, child_ctx);
						if (have_grandchild) {
							candidate = child;
							candidate_ctx = child_ctx;
						}
					}
				}
				else if (!child.firstchild_ineligible) {
					if (!candidate || node_weight(candidate) > node_weight(child)) {
						candidate = child;
						candidate_ctx = child_ctx;
					}
				}
			}
		}
	}

	if (!candidate)
		return false;

	for (let k, v in candidate_ctx)
		ctx[k] = v;

	return true;
}

function resolve_page(tree, request_path) {
	let node = tree;
	let login = false;
	let session = null;
	let ctx = {};

	for (let i, s in request_path) {
		node = node.children?.[s];

		if (!node?.satisfied)
			break;

		ctx_append(ctx, s, node);

		if (!session)
			session = is_authenticated(node.auth);

		if (!login && node.auth?.login)
			login = true;

		if (node.wildcard) {
			ctx.request_args = [];
			ctx.request_path = ctx.path ? [ ...ctx.path ] : [];

			while (++i < length(request_path)) {
				push(ctx.request_path, request_path[i]);
				push(ctx.request_args, request_path[i]);
			}

			break;
		}
	}

	if (node?.action?.type == 'firstchild')
		resolve_firstchild(node, session, login, ctx);

	ctx.acls ??= {};
	ctx.path ??= [];
	ctx.request_args ??= [];
	ctx.request_path ??= request_path ? [ ...request_path ] : [];

	ctx.authsession = session?.sid;
	ctx.authtoken = session?.data?.token;
	ctx.authuser = session?.data?.username;
	ctx.authacl = session?.acls;

	node = tree;

	for (let s in ctx.path) {
		node = node.children[s];
		assert(node, "Internal node resolve error");
	}

	return { node, ctx, session };
}

function require_post_security(target, args) {
	if (target?.type == 'arcombine')
		return require_post_security(length(args) ? target?.targets?.[1] : target?.targets?.[0], args);

	if (type(target?.post) == 'object') {
		for (let param_name, required_val in target.post) {
			let request_val = http.formvalue(param_name);

			if ((type(required_val) == 'string' && request_val != required_val) ||
			    (required_val == true && request_val == null))
				return false;
		}

		return true;
	}

	return (target?.post == true);
}

function test_post_security(authtoken) {
	if (http.getenv("REQUEST_METHOD") != "POST") {
		http.status(405, "Method Not Allowed");
		http.header("Allow", "POST");

		return false;
	}

	if (http.formvalue("token") != authtoken) {
		http.status(403, "Forbidden");
		runtime.render("csrftoken");

		return false;
	}

	return true;
}

function build_url(...path) {
	let url = [ http.getenv('SCRIPT_NAME') ?? '' ];

	for (let p in path)
		if (match(p, /^[A-Za-z0-9_%.\/,;-]+$/))
			push(url, '/', p);

	if (length(url) == 1)
		push(url, '/');

	return join('', url);
}

function lookup(...segments) {
	let node = menu_json();
	let path = [];

	for (let segment in segments)
		for (let name in split(segment, '/'))
			push(path, name);

	for (let name in path) {
		node = node.children[name];

		if (!node)
			return null;

		if (node.leaf)
			break;
	}

	return { node, url: build_url(...path) };
}

function rollback_pending() {
	const now = time();
	const rv = ubus.call('session', 'get', {
		ubus_rpc_session: '00000000000000000000000000000000',
		keys: [ 'rollback' ]
	});

	if (type(rv?.values?.rollback?.token) != 'string' ||
	    type(rv?.values?.rollback?.session) != 'string' ||
	    type(rv?.values?.rollback?.timeout) != 'int' ||
	    rv.values.rollback.timeout <= now)
	    return false;

	return {
		remaining: rv.values.rollback.timeout - now,
		session: rv.values.rollback.session,
		token: rv.values.rollback.token
	};
}

let dispatch;

function render_action(fn) {
	const data = render(fn);

	http.write_headers();
	http.output(data);
}

function run_action(request_path, lang, tree, resolved, action) {
	switch ((type(action) == 'object') ? action.type : 'none') {
	case 'template':
		if (runtime.is_ucode_template(action.path))
			runtime.render(action.path, {});
		else
			render_action(() => {
				runtime.call('luci.dispatcher', 'render_lua_template', action.path);
			});
		break;

	case 'view':
		runtime.render('view', { view: action.path });
		break;

	case 'call':
		render_action(() => {
			runtime.call(action.module, action.function,
				...(action.parameters ?? []),
				...resolved.ctx.request_args
			);
		});
		break;

	case 'function':
		const mod = require(action.module);

		assert(type(mod[action.function]) == 'function',
			`Module '${action.module}' does not export function '${action.function}'`);

		render_action(() => {
			call(mod[action.function], mod, runtime.env,
				...(action.parameters ?? []),
				...resolved.ctx.request_args
			);
		});
		break;

	case 'cbi':
		render_action(() => {
			runtime.call('luci.dispatcher', 'invoke_cbi_action',
				action.path, null,
				...resolved.ctx.request_args
			);
		});
		break;

	case 'form':
		render_action(() => {
			runtime.call('luci.dispatcher', 'invoke_form_action',
				action.path,
				...resolved.ctx.request_args
			);
		});
		break;

	case 'alias':
		dispatch(http, [ ...split(action.path, '/'), ...resolved.ctx.request_args ]);
		break;

	case 'rewrite':
		dispatch(http, [
			...splice([ ...request_path ], 0, action.remove),
			...split(action.path, '/'),
			...resolved.ctx.request_args
		]);
		break;

	case 'firstchild':
		if (!length(tree.children)) {
			error404("No root node was registered, this usually happens if no module was installed.\n" +
			         "Install luci-mod-admin-full and retry. " +
			         "If the module is already installed, try removing the /tmp/luci-indexcache file.");
			break;
		}

		/* fall through */

	case 'none':
		error404(`No page is registered at '/${entityencode(join("/", resolved.ctx.request_path))}'.\n` +
		         "If this url belongs to an extension, make sure it is properly installed.\n" +
		         "If the extension was recently installed, try removing the /tmp/luci-indexcache file.");
		break;

	default:
		error500(`Unhandled action type ${action?.type ?? '?'}`);
	}
}

dispatch = function(_http, path) {
	http = _http;

	let version = determine_version();
	let lang = determine_request_language();

	runtime = runtime || LuCIRuntime({
		http,
		ubus,
		uci,
		ctx: {},
		version,
		config: {
			main: uci.get_all('luci', 'main') ?? {},
			apply: uci.get_all('luci', 'apply') ?? {}
		},
		dispatcher: {
			rollback_pending,
			is_authenticated,
			load_luabridge,
			lookup,
			menu_json,
			build_url,
			randomid,
			error404,
			error500,
			lang
		},
		striptags,
		entityencode,
		_: (...args) => translate(...args) ?? args[0],
		N_: (...args) => ntranslate(...args) ?? (args[0] == 1 ? args[1] : args[2]),
	});

	try {
		let menu = menu_json();

		path ??= map(match(http.getenv('PATH_INFO'), /[^\/]+/g), m => urldecode(m[0]));

		let resolved = resolve_page(menu, path);

		runtime.env.ctx = resolved.ctx;
		runtime.env.dispatched = resolved.node;
		runtime.env.requested ??= resolved.node;

		if (length(resolved.ctx.auth)) {
			let session = is_authenticated(resolved.ctx.auth);

			if (!session && resolved.ctx.auth.login) {
				let user = http.getenv('HTTP_AUTH_USER');
				let pass = http.getenv('HTTP_AUTH_PASS');

				if (user == null && pass == null) {
					user = http.formvalue('luci_username');
					pass = http.formvalue('luci_password');
				}

				if (user != null && pass != null)
					session = session_setup(user, pass, resolved.ctx.request_path);

				if (!session) {
					resolved.ctx.path = [];

					http.status(403, 'Forbidden');
					http.header('X-LuCI-Login-Required', 'yes');

					let scope = { duser: 'root', fuser: user };
					let theme_sysauth = `themes/${basename(runtime.env.media)}/sysauth`;

					if (runtime.is_ucode_template(theme_sysauth) || runtime.is_lua_template(theme_sysauth)) {
						try {
							return runtime.render(theme_sysauth, scope);
						}
						catch (e) {
							runtime.env.media_error = `${e}`;
						}
					}

					return runtime.render('sysauth', scope);
				}

				let cookie_name = (http.getenv('HTTPS') == 'on') ? 'sysauth_https' : 'sysauth_http',
				    cookie_secure = (http.getenv('HTTPS') == 'on') ? '; secure' : '';

				http.header('Set-Cookie', `${cookie_name}=${session.sid}; path=${build_url()}; SameSite=strict; HttpOnly${cookie_secure}`);
				http.redirect(build_url(...resolved.ctx.request_path));

				return;
			}

			if (!session) {
				http.status(403, 'Forbidden');
				http.header('X-LuCI-Login-Required', 'yes');

				return;
			}

			resolved.ctx.authsession ??= session.sid;
			resolved.ctx.authtoken ??= session.data?.token;
			resolved.ctx.authuser ??= session.data?.username;
			resolved.ctx.authacl ??= session.acls;

			/* In case the Lua runtime was already initialized, e.g. by probing legacy
			 * theme header templates, make sure to update the session ID of the uci
			 * module. */
			if (runtime.L) {
				runtime.L.invoke('require', 'luci.model.uci');
				runtime.L.get('luci', 'model', 'uci').invoke('set_session_id', session.sid);
			}
		}

		if (length(resolved.ctx.acls)) {
			let perm = check_acl_depends(resolved.ctx.acls, resolved.ctx.authacl?.['access-group']);

			if (perm == null) {
				http.status(403, 'Forbidden');

				return;
			}

			if (resolved.node)
				resolved.node.readonly = !perm;
		}

		let action = resolved.node.action;

		if (action?.type == 'arcombine')
			action = length(resolved.ctx.request_args) ? action.targets?.[1] : action.targets?.[0];

		if (resolved.ctx.cors && http.getenv('REQUEST_METHOD') == 'OPTIONS') {
			http.status(200, 'OK');
			http.header('Access-Control-Allow-Origin', http.getenv('HTTP_ORIGIN') ?? '*');
			http.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

			return;
		}

		if (require_post_security(action) && !test_post_security(resolved.ctx.authtoken))
			return;

		run_action(path, lang, menu, resolved, action);
	}
	catch (ex) {
		error500('Unhandled exception during request dispatching', ex);
	}
};

export default dispatch;
