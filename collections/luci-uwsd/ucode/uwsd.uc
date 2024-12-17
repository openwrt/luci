import { connect as ubus_connect, error as ubus_error } from 'ubus';
import { stdin, realpath, readfile, error as fs_error } from 'fs';
import { timer } from 'uloop';
import { cursor } from 'uci';

import dispatch from 'luci.dispatcher';
import request from 'luci.http';

const LUCI_WS_PROTO_NAME = 'org.openwrt.luci.v0';
const LUCI_WS_PROTO_KEEPALIVE = 5000;

let ubus_ctx;

function server_name(host_header, local_address) {
	let m;

	if (host_header != null) {
		if ((m = match(host_header, /^\[([[:xdigit:]:]+)\]:\d{1,5}$/)) != null)
			return `[${iptoarr(arrtoip(m[1]))}]`;

		if ((m = match(host_header, /^([^:]+):\d{1,5}$/)) != null)
			return m[1];

		return host_header;
	}

	let addr = iptoarr(local_address);

	switch (length(addr)) {
	case 16: return `[${arrtoip(addr)}]`;
	default: return arrtoip(addr);
	}
}

function resolve_action(uri) {
	let uri_query = split(uri, '?', 2);
	let segments = filter(split(uri_query[0], '/'), s => s != '' && s != '.' && s != '..');

	if (segments[0] != 'cgi-bin')
		return null;

	switch (segments[1]) {
	case 'luci':
		return {
			name: '/cgi-bin/luci',
			info: `/${join('/', slice(segments, 2))}`,
			query: uri_query[1] ?? '',
			command: function() {
				let req = request(getenv(), () => {
					let data = stdin.read(4096);

					return length(data) ? data : null;
				});

				dispatch(req);
			}
		};

	case 'cgi-exec':
	case 'cgi-backup':
	case 'cgi-upload':
	case 'cgi-download':
		return {
			name: `/cgi-bin/${segments[0]}`,
			info: `/${join('/', slice(segments, 2))}`,
			command: '/usr/libexec/cgi-io',
			args: [ segments[1] ]
		};
	}

	return null;
}

export function onRequest(conn, method, uri) {
	// Obtain connection info
	let conn_info = conn.info();

	// determine action
	let action = resolve_action(uri);

	// Prepare CGI environment
	let env = {
		SERVER_SOFTWARE: 'uwsd',
		SERVER_NAME: server_name(conn.header('Host'), conn_info.local_address),
		SERVER_ADDR: conn_info.local_address,
		SERVER_PORT: conn_info.local_port,
		GATEWAY_INTERFACE: 'CGI/1.1',
		CONTENT_TYPE: conn.header('Content-Type'),
		REMOTE_ADDR: conn_info.peer_address,
		REMOTE_PORT: conn_info.peer_port,
		REQUEST_METHOD: method,
		REQUEST_URI: uri,
		SERVER_PROTOCOL: sprintf('HTTP/%3.1f', conn.version()),
		SCRIPT_NAME: action.name,
		PATH_INFO: action.info,
		QUERY_STRING: action.query ?? '',
		DOCUMENT_ROOT: realpath(getenv('DOCUMENT_ROOT') ?? '/www'),
		CONTENT_LENGTH: conn.header('Content-Length'),
		HTTPS: conn_info.ssl ? 'on' : null
	};

	for (let hdrname, hdrvalue in conn.header())
		env[`HTTP_${uc(replace(hdrname, /\W+/g, '_'))}`] = hdrvalue;

	let task = uwsd.spawn(action.command, action.args, env);

	conn.data(task);
};

export function onBody(conn, data) {
	let task = conn.data();

	if (length(data))
		return task.stdin().write(data);

	task.stdin().close();

	for (let chunk = task.stdout().read(4096); length(chunk); chunk = task.stdout().read(4096))
		conn.send(chunk);

	task.close();
};


function check_ws_authentication(conn, sessid, ticket) {
	ubus_ctx ??= ubus_connect();
	assert(ubus_ctx, `Unable to establish ubus connection: ${ubus_error()}`);

	if (!ticket) {
		conn.reply({ 'Status': '400 Bad Request' }, 'No ticket in subprotocol proposal');
		conn.close(1002, 'No ticket in subprotocol proposal');

		return;
	}

	let session = ubus_ctx.call('session', 'list', { ubus_rpc_session: sessid });

	if (!session) {
		conn.reply({ 'Status': '401 Unauthorized' }, 'Session is invalid');
		conn.close(1008, 'Session is invalid');

		return;
	}

	let sessticket = session.data?.ws_auth_ticket;

	if (sessticket?.[0] !== ticket) {
		conn.reply({ 'Status': '401 Unauthorized' }, 'Ticket is invalid');
		conn.close(1008, 'Ticket is invalid');

		return;
	}

	let nowtv = clock(true);

	if (nowtv[0] * 1000 + nowtv[1] / 1000000 >= sessticket?.[1]) {
		conn.reply({ 'Status': '401 Unauthorized' }, 'Ticket is expired');
		conn.close(1008, 'Ticket is expired');

		return;
	}

	ubus_ctx.call('session', 'unset', {
		ubus_rpc_session: sessid,
		keys: [ 'ws_auth_ticket' ]
	});

	return session;
}

export function onConnect(conn, protocols) {
	let ticketdata = null;

	// find handshake ticket in protocol proposals
	for (let p in protocols)
		if (index(p, `${LUCI_WS_PROTO_NAME}.ticket!`) == 0)
			ticketdata = split(p, '!', 3);

	let session = check_ws_authentication(conn, ticketdata?.[1], ticketdata?.[2]);

	if (!session)
		return;

	conn.accept(LUCI_WS_PROTO_NAME);
	conn.data(session);
};


function check_ubus_access_permission(session, payload) {
	return ubus_ctx.call('session', 'access', {
		ubus_rpc_session: session.ubus_rpc_session,
		scope:            'ubus',
		object:           payload.object,
		function:         payload.method
	})?.access === true;
}

function handle_ws_ubus_message(conn, session, payload) {
	let result, error;

	ubus_ctx ??= ubus_connect();
	assert(ubus_ctx, `Unable to establish ubus connection: ${ubus_error()}`);

	if (type(payload) != 'object')
		return conn.close(1002, 'Invalid message payload');

	if (type(payload.id) != 'int' && type(payload.id) != 'string')
		return conn.close(1002, 'Invalid message ID attribute');

	switch (payload.operation) {
	case 'list':
		if (payload.object != null && type(payload.object) != 'string')
			return conn.close(1002, 'Invalid message object attribute');

		result = ubus_ctx.list(payload.object);
		error = ubus_ctx.error();

		return conn.send(`${ error ? { id: payload.id, error } : { id: payload.id, result }}`);

	case 'call':
		if (type(payload.object) != 'string')
			return conn.close(1002, 'Invalid message object attribute');

		if (type(payload.method) != 'string')
			return conn.close(1002, 'Invalid message method attribute');

		if (payload.params != null && type(payload.params) != 'object')
			return conn.close(1002, 'Invalid message params attribute');

		if ('ubus_rpc_session' in payload.params)
			return conn.close(1002, 'Illegal message params attribute');

		if (!check_ubus_access_permission(session, payload))
			return conn.send(`${{ id: payload.id, error: `Access denied by ACL (${ubus_ctx.error()})` }}`);

		result = ubus_ctx.call(payload.object, payload.method, {
			ubus_rpc_session: session.ubus_rpc_session,
			...(payload.params ?? {})
		});

		error = ubus_ctx.error(true);

		conn.send(`${ error ? { id: payload.id, error } : { id: payload.id, result }}`);
		return;

	default:
		conn.send(`${{ id: payload.id, error: 'Unrecognized operation' }}`);
		break;
	}
}

function handle_ws_resource_message(conn, session, payload) {
	if (type(payload) != 'object')
		return conn.close(1002, 'Invalid message payload');

	if (type(payload.path) != 'string')
		return conn.close(1002, 'Invalid message path attribute');

	const base = cursor().get('luci', 'main', 'resourcebase');

	if (!base)
		return conn.send(`${{ id: payload.id, error: 'Unable to determine resource base directory' }}`);

	const root = realpath(`${getenv('DOCUMENT_ROOT') ?? '/www'}/${base}`);
	const path = realpath(`${root}/${payload.path}`);

	if (index(path, root) !== 0 || ord(path, length(root)) !== 0x2f)
		return conn.send(`${{ id: payload.id, error: 'Invalid resource path requested' }}`);

	const data = readfile(path);

	conn.send(`${data != null ? { id: payload.id, data } : { id: payload.id, error: fs_error() } }`);
}

function handle_ws_message(conn, session, message) {
	for (let kind, payload in message) {
		switch (kind) {
		case 'keepalive':
			break;

		case 'ubus':
			handle_ws_ubus_message(conn, session, payload);
			break;

		case 'resource':
			handle_ws_resource_message(conn, session, payload);
			break;

		default:
			return conn.close(1002, `Unrecognized message type '${kind}'`);
		}
	}
}

export function onData(conn, msg) {
	handle_ws_message(conn, conn.data(), msg);
};


function send_keepalive() {
	for (let conn in uwsd.connections())
		conn.send('{ "keepalive": true }');

	timer(LUCI_WS_PROTO_KEEPALIVE, send_keepalive);
}

send_keepalive();
