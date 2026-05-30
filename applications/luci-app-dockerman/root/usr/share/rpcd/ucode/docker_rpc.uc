#!/usr/bin/env ucode

// Copyright 2025 Paul Donald / luci-lib-docker-js
// Licensed to the public under the Apache License 2.0.
// Built against the docker v1.47 API


'use strict';

import * as http from 'luci.http';
import * as fs from 'fs';
import * as socket from 'socket';
import { cursor } from 'uci';
import * as ds from 'luci.docker_socket';

// const cmdline = fs.readfile('/proc/self/cmdline');
// const args = split(cmdline, '\0');
const caller = trim(fs.readfile('/proc/self/comm'));

const BLOCKSIZE = 8192;
const POLL_TIMEOUT = 8000; // default; can be overridden per request
// const API_VER = '/v1.47';
const PROTOCOL = 'HTTP/1.1';
const CLIENT_VER = '1';

function merge(a, b) {
	let c = {};
	for (let k, v in a)
		c[k] = v;
	for (let k, v in b)
		c[k] = v;
	return c;
};

function chunked_body_reader(sock, initial_buffer) {
	let state = 0, chunklen = 0, buffer = initial_buffer || '';

	function poll_and_recv() {
		let ready = socket.poll(POLL_TIMEOUT, [sock, socket.POLLIN]);
		if (!ready || !length(ready)) return null;
		let data = sock.recv(BLOCKSIZE);
		if (!data) return null;
		buffer += data;
		return true;
	}

	return () => {
		while (true) {
			if (state === 0) {
				let m = match(buffer, /^([0-9a-fA-F]+)\r\n/);
				if (!m || length(m) < 2) {
					if (!poll_and_recv()) return null;
					continue;
				}
				chunklen = int(m[1], 16);
				buffer = substr(buffer, length(m[0]));
				if (chunklen === 0) return null;
				state = 1;
			}
			if (state === 1 && length(buffer) >= chunklen + 2) {
				let chunk = substr(buffer, 0, chunklen);
				buffer = substr(buffer, chunklen + 2);
				state = 0;
				return chunk;
			} else {
				if (!poll_and_recv()) return null;
				continue;
			}
		}
	};
};

function read_http_headers(response_headers, response) {
	const lines = split(response, /\r?\n/);

	for (let l in lines) {
		let kv = match(l, /([^:]+):\s*(.*)/);
		if (kv && length(kv) === 3)
			response_headers[lc(kv[1])] = kv[2];
	}

	return response_headers;
};

function get_api_ver() {

	const ctx = cursor();
	const version = ctx.get('dockerd', 'globals', 'api_version') || '';
	const version_str = version ? `/${version}` : '';
	ctx.unload();

	return version_str;
};

function coerce_values_to_string(obj) {
	for (let k, v in obj) {
		v = `${v}`;
		obj[k]=v;
	}
	return obj;
};

function call_docker(method, path, options) {
	options = options || {};
	const headers = options.headers || {};
	let payload = options.payload || null;

	/* requires ucode 2026-01-16 if get_socket_dest() provides ip:port e.g.
	'127.0.0.1:2375'.
	We use get_socket_dest_compat() which builds the SockAddress manually to
	avoid this.

	Important: dockerd after v28 won't accept tcp://x.x.x.x:2375 without
	--tls* options.

	A solution is a reverse proxy or ssh port forwarding to a remote host that
	uses the unix socket, and you still connect to a 'local port', or socket:
	ssh -L /tmp/docker.sock:localhost:2375 user@remote-host (openssh-client)
	or (dropbear)
	socat TCP-LISTEN:12375,reuseaddr,fork UNIX-CONNECT:/var/run/docker.sock
	ssh -L 2375:localhost:12375 user@remote-host
	*/


	/* works on ucode 2025-12-01 */
	const sock_dest = ds.get_socket_dest_compat();
	const sock = socket.create(sock_dest.family, socket.SOCK_STREAM);

	/* works on ucode 2026-01-16 */
	// const sock_dest = ds.get_socket_dest();
	// const sock_addr = socket.sockaddr(sock_dest);
	// const sock = socket.create(sock_addr.family, socket.SOCK_STREAM);

	if (caller != 'rpcd') {
		print('sock_dest:', sock_dest, '\n');
		// print('sock_addr:', sock_addr, '\n');
	}
	if (!sock) {
		return {
			code: 500,
			headers: {},
			body: { message: "Failed to create socket" }
		};
	}

	let conn_result = sock.connect(sock_dest);
	let err_msg = `Failed to connect to docker host at ${sock_dest}`;
	if (!conn_result) {
		sock.close();
		return {
			code: 500,
			headers: {},
			body: { message: err_msg}
		};
	}

	if (caller != 'rpcd')
		print("query: ", options.query, '\n');

	const query = options.query ? http.build_querystring(coerce_values_to_string(options.query)) : '';
	const url = path + query;

	const req_headers = [
		`${method} ${get_api_ver()}${url} ${PROTOCOL}`,
		`Host: luci-host`,
		`User-Agent: luci-app-dockerman-rpc-ucode/${CLIENT_VER}`,
		`Connection: close`
	];

	if (payload) {
		if (type(payload) === 'object') {
			payload = sprintf('%J', payload);
			headers['Content-Type'] = 'application/json';
		}
		headers['Content-Length'] = '' + length(payload);
	}

	for (let k, v in headers)
		push(req_headers, `${k}: ${v}`);

	push(req_headers, '', '');

	if (caller != 'rpcd')
		print(join('\r\n', req_headers), "\n");

	sock.send(join('\r\n', req_headers));
	if (payload) sock.send(payload);

	const response_buff = sock.recv(BLOCKSIZE);
	if (!response_buff || response_buff === '') {
		sock.close();
		return {
			code: 500,
			headers: {},
			body: { message: "No response from Docker socket" }
		};
	}
	
	const response_parts = split(response_buff, /\r?\n\r?\n/, 2);
	const response_headers = read_http_headers({}, response_parts[0]);
	let response_body;

	let is_chunked = (response_headers['transfer-encoding'] === 'chunked');

	let reader;
	if (is_chunked) {
		reader = chunked_body_reader(sock, response_parts[1]);
	}
	else if (response_headers['content-length']) {
		let content_length = int(response_headers['content-length']);
		let buf = response_parts[1];

		reader = () => {
			if (content_length <= 0) return null;

			if (buf && length(buf)) {
				let chunk = substr(buf, 0, content_length);
				buf = substr(buf, length(chunk));
				content_length -= length(chunk);
				return chunk;
			}

			let data = sock.recv(min(BLOCKSIZE, content_length));
			if (!data || data === '') return null;

			content_length -= length(data);
			return data;
		};
	}
	else {
		// Fallback for HTTP/1.0 or no content-length: read until close or timeout
		reader = () => {
			// Poll with 2 second timeout
			let ready = socket.poll(POLL_TIMEOUT, [sock, socket.POLLIN]);
			if (!ready || !length(ready)) return null; // Timeout or error

			let data = sock.recv(BLOCKSIZE);
			if (!data || data === '') return null;
			return data;
		};
	}

	let chunks = [], chunk;
	while ((chunk = reader())) {
		push(chunks, chunk);
	}

	sock.close();

	response_body = join('', chunks);

	// Parse HTTP status code
	let status_line = split(response_parts[0], /\r?\n/)[0];
	let status_match = match(status_line, /HTTP\/\S+\s+(\d+)/);
	let code = status_match ? int(status_match[1]) : 0;

	// Docker events endpoint returns newline-delimited JSON, not a single JSON object
	if (response_headers['content-type'] === 'application/json' && response_body) {
		// Single JSON object
		let data;
		try { data = json(rtrim(response_body)); }
		catch { data = null; }

		// Check if this is newline-delimited JSON (multiple lines with JSON objects)
		if (!data) {
			// Parse each line as a separate JSON object
			let lines = split(trim(response_body), /\n/);
			let events = [];
			for (let line in lines) {
				line = trim(line);
				if (line) {
					try { push(events, json(line)); }
					catch { /* skip invalid lines */ }
				}
			}
			response_body = events;
		} else {
			response_body = data;
		}
	}

	return {
		code: code,
		headers: response_headers,
		body: response_body
	};
};

function run_ttyd(request) {

	const id = request.args.id || '';
	const cmd = request.args.cmd || '/bin/sh';
	const port = request.args.port || 7682;
	const uid = request.args.uid || '';

	if (!id) {
		return { error: 'Container ID is required' };
	}

	let ttyd_cmd = `ttyd -q -d 2 --once --writable -p ${port} docker`;
	const sock_addr = ds.get_socket_dest();

	/* Build the full command:
	ttyd --writable -d 2 --once -p PORT docker -H unix://SOCKET exec -it [-u UID] CONTAINER CMD

	if the socket is /var/run/docker.sock, prefix unix://

	Note: invocations of docker -H x.x.x.x:2375 [..] will fail after v27 without --tls*
	*/
	const sock_str = index(sock_addr, '/') != -1 && index(sock_addr, 'unix://') == -1 ? 'unix://' + sock_addr : sock_addr;
	ttyd_cmd = `${ttyd_cmd} -H "${sock_str}" exec -it`;
	if (uid && uid !== '') {
		ttyd_cmd = `${ttyd_cmd} -u ${uid}`;
	}

	ttyd_cmd = `${ttyd_cmd} ${id} ${cmd} &`;

	// Try to kill any existing ttyd processes on this port
	system(`pkill -f "ttyd.*-p ${port}"` + ' 2>/dev/null; true');

	// Start ttyd
	system(ttyd_cmd);

	return { status: 'ttyd started', command: ttyd_cmd };
}

// https://docs.docker.com/reference/api/engine/version/v1.47/

/* Note: methods here are included for structural reference. Some rpcd methods
are not suitable to be called from the GUI because they are streaming endpoints
or the operations in a busy dockerd cluster take a *long* time which causes
timeouts at the front end. Good examples of this are:
- /system/df 
- push
- pull
- all /prune

We include them here because they can be useful from the command line.
*/

const core_methods = {
	version: { call: () => call_docker('GET', '/version') },
	info:    { call: () => call_docker('GET', '/info') },
	ping:    { call: () => call_docker('GET', '/_ping') },
	df:      { call: () => call_docker('GET', '/system/df') },
	events:  { args: { query: { 'since': '', 'until': `${time()}`, 'filters': '' } }, call: (request) => call_docker('GET', '/events', { query: request?.args?.query }) },
};

const exec_methods = {
	start:   { args: { id: '', body: '' }, call: (request) => call_docker('POST', `/exec/${request.args.id}/start`, { payload: request.args.body }) },
	resize:  { args: { id: '', query: { 'h': 0, 'w': 0 } }, call: (request) => call_docker('POST', `/exec/${request.args.id}/resize`, { query: request.args.query }) },
	inspect: { args: { id: '' }, call: (request) => call_docker('GET', `/exec/${request.args.id}/json`) },
};

const container_methods = {
	list:    { args: { query: { 'all': false, 'limit': false, 'size': false, 'filters': '' } }, call: (request) => call_docker('GET', '/containers/json', { query: request.args.query }) },
	create:  { args: { query: { 'name': '', 'platform': '' }, body: {} }, call: (request) => call_docker('POST', '/containers/create', { query: request.args.query, payload: request.args.body }) },
	inspect: { args: { id: '', query: { 'size': false } }, call: (request) => call_docker('GET', `/containers/${request.args.id}/json`, { query: request.args.query }) },
	top:     { args: { id: '', query: { 'ps_args': '' } }, call: (request) => call_docker('GET', `/containers/${request.args.id}/top`, { query: request.args.query }) },
	logs:    { args: { id: '', query: {} }, call: (request) => call_docker('GET', `/containers/${request.args.id}/logs`, { query: request.args.query }) },
	changes: { args: { id: '' }, call: (request) => call_docker('GET', `/containers/${request.args.id}/changes`) },
	export:  { args: { id: '' }, call: (request) => call_docker('GET', `/containers/${request.args.id}/export`) },
	stats:   { args: { id: '', query: { 'stream': false, 'one-shot': false } }, call: (request) => call_docker('GET', `/containers/${request.args.id}/stats`, { query: request.args.query }) },
	resize:  { args: { id: '', query: { 'h': 0, 'w': 0 } }, call: (request) => call_docker('POST', `/containers/${request.args.id}/resize`, { query: request.args.query }) },
	start:   { args: { id: '', query: { 'detachKeys': '' } }, call: (request) => call_docker('POST', `/containers/${request.args.id}/start`, { query: request.args.query }) },
	stop:    { args: { id: '', query: { 'signal': '', 't': 0 } }, call: (request) => call_docker('POST', `/containers/${request.args.id}/stop`, { query: request.args.query }) },
	restart: { args: { id: '', query: { 'signal': '', 't': 0 } }, call: (request) => call_docker('POST', `/containers/${request.args.id}/restart`, { query: request.args.query }) },
	kill:    { args: { id: '', query: { 'signal': '' } }, call: (request) => call_docker('POST', `/containers/${request.args.id}/kill`, { query: request.args.query }) },
	update:  { args: { id: '', body: {} }, call: (request) => call_docker('POST', `/containers/${request.args.id}/update`, { payload: request.args.body }) },
	rename:  { args: { id: '', query: { 'name': '' } }, call: (request) => call_docker('POST', `/containers/${request.args.id}/rename`, { query: request.args.query }) },
	pause:   { args: { id: '' }, call: (request) => call_docker('POST', `/containers/${request.args.id}/pause`) },
	unpause: { args: { id: '' }, call: (request) => call_docker('POST', `/containers/${request.args.id}/unpause`) },
	// attach
	// attach websocket
	// wait
	remove:  { args: { id: '', query: { 'v': false, 'force': false, 'link': false } }, call: (request) => call_docker('DELETE', `/containers/${request.args.id}`, { query: request.args.query }) },
	// archive info
	info_archive: { args: { id: '', query: { 'path': '' } }, call: (request) => call_docker('HEAD', `/containers/${request.args.id}/archive`, { query: request.args.query }) },
	// archive get
	get_archive:  { args: { id: '', query: { 'path': '' } }, call: (request) => call_docker('GET', `/containers/${request.args.id}/archive`, { query: request.args.query }) },
	// archive extract
	put_archive:  { args: { id: '', query: { 'path': '', 'noOverwriteDirNonDir': '', 'copyUIDGID': '' }, body: '' }, call: (request) => call_docker('PUT', `/containers/${request.args.id}/archive`, { query: request.args.query, payload: request.args.body }) },
	exec:    { args: { id: '', opts: {} }, call: (request) => call_docker('POST', `/containers/${request.args.id}/exec`, { payload: request.args.opts }) },
	prune:   { args: { query: { 'filters': '' } }, call: (request) => call_docker('POST', '/containers/prune', { query: request.args.query }) },

	// Not a docker command - but a local command to invoke ttyd so our browser can open websocket to docker
	ttyd_start: { args: { id: '', cmd: '/bin/sh', port: 7682, uid: '' }, call: (request) => run_ttyd(request) },
};

const image_methods = {
	list:    { args: { query: { 'all': false, 'digests': false, 'shared-size': false, 'manifests': false, 'filters': '' } }, call: (request) => call_docker('GET', '/images/json', { query: request.args.query }) },
	// build is long-running, and will likely cause time-out on the call. Function only here for reference.
	build:   { args: { query: { '': '' }, headers: {} }, call: (request) => call_docker('POST', '/build', { query: request.args.query, headers: request.args.headers }) },
	build_prune: { args: { query: { '': '' }, headers: {} }, call: (request) => call_docker('POST', '/build/prune', { query: request.args.query, headers: request.args.headers }) },
	create:  { args: { query: { '': '' }, headers: {} }, call: (request) => call_docker('POST', '/images/create', { query: request.args.query, headers: request.args.headers }) },
	inspect: { args: { id: '' }, call: (request) => call_docker('GET', `/images/${request.args.id}/json`) },
	history: { args: { id: '' }, call: (request) => call_docker('GET', `/images/${request.args.id}/history`) },
	push:    { args: { name: '', query: { tag: '', platform: '' }, headers: {} }, call: (request) => call_docker('POST', `/images/${request.args.name}/push`, { query: request.args.query, headers: request.args.headers }) },
	tag:     { args: { id: '', query: { 'repo': '', 'tag': '' } }, call: (request) => call_docker('POST', `/images/${request.args.id}/tag`, { query: request.args.query }) },
	remove:  { args: { id: '', query: { 'force': false, 'noprune': false } }, call: (request) => call_docker('DELETE', `/images/${request.args.id}`, { query: request.args.query }) },
	search:  { args: { query: { 'term': '', 'limit': 0, 'filters': '' } }, call: (request) => call_docker('GET', '/images/search', { query: request.args.query }) },
	prune:   { args: { query: { 'filters': '' } }, call: (request) => call_docker('POST', '/images/prune', { query: request.args.query }) },
	// create/commit
	get:     { args: { id: '' }, call: (request) => call_docker('GET', `/images/${request.args.id}/get`) },
	// get == export several
	load:    { args: { query: { 'quiet': false } }, call: (request) => call_docker('POST', '/images/load', { query: request.args.query }) },
};

const network_methods = {
	list:    { args: { query: { 'filters': '' } }, call: (request) => call_docker('GET', '/networks', { query: request.args.query }) },
	inspect: { args: { id: '', query: { 'verbose': false, 'scope': '' } }, call: (request) => call_docker('GET', `/networks/${request.args.id}`, { query: request.args.query }) },
	remove:  { args: { id: '' }, call: (request) => call_docker('DELETE', `/networks/${request.args.id}`) },
	create:  { args: { body: {} }, call: (request) => call_docker('POST', '/networks/create', { payload: request.args.body }) },
	connect: { args: { id: '', body: {} }, call: (request) => call_docker('POST', `/networks/${request.args.id}/connect`, { payload: request.args.body }) },
	disconnect: { args: { id: '', body: {} }, call: (request) => call_docker('POST', `/networks/${request.args.id}/disconnect`, { payload: request.args.body }) },
	prune:   { args: { query: { 'filters': '' } }, call: (request) => call_docker('POST', '/networks/prune', { query: request.args.query }) },
};

const volume_methods = {
	list:    { args: { query: { 'filters': '' } }, call: (request) => call_docker('GET', '/volumes', { query: request.args.query }) },
	create:  { args: { opts: {} }, call: (request) => call_docker('POST', '/volumes/create', { payload: request.args.opts }) },
	inspect: { args: { id: '' }, call: (request) => call_docker('GET', `/volumes/${request.args.id}`) },
	update:  { args: { id: '', query: { 'version': 0 }, spec: {} }, call: (request) => call_docker('PUT', `/volumes/${request.args.id}`, { query: request.args.query, payload: request.args.spec }) },
	remove:  { args: { id: '', query: { 'force': false } }, call: (request) => call_docker('DELETE', `/volumes/${request.args.id}`, { query: request.args.query }) },
	prune:   { args: { query: { 'filters': '' } }, call: (request) => call_docker('POST', '/volumes/prune', { query: request.args.query }) },
};

const methods = {
	'docker': core_methods, 
	'docker.container': container_methods,
	'docker.exec': exec_methods,
	'docker.image': image_methods,
	'docker.network': network_methods,
	'docker.volume': volume_methods,
};

// CLI test mode - check if script is run directly (not loaded by rpcd)
if (caller != 'rpcd') {
	// Usage: ./docker_rpc.uc <object.method> <json-args>
	// Example: ./docker_rpc.uc docker.network.list '{"query":{"filters":""}}'
	// Example: ./docker_rpc.uc docker.image.create '{"query":{"fromImage":"alpine","tag":"latest"}}'
	const scr_name = split(SCRIPT_NAME, '/')[-1] || 'docker_rpc.uc';

	if (length(ARGV) < 1) {
		print(`Usage: ${scr_name} <object.method> [json-args]\n`);

		print("Available methods:\n");
		for (let obj in methods) {
			for (let name, info in methods[obj]) {
				let sig = name;
				if (info && info.args) {
					try {
						sig = `${sig} ${sprintf('\'%J\'', info.args)}`;
					} catch {
						sig = `${sig} <args>`;
					}
				}
				print(`  ${obj}.${sig}\n`);
			}
		}

		print("\nExamples:\n");
		print(`  ${scr_name} docker.version\n`);
		print(`  ${scr_name} docker.network.list '{"query":{}}'\n`);
		print(`  ${scr_name} docker.image.create '{"query":{"fromImage":"alpine","tag":"latest"}}'\n`);
		print(`  ${scr_name} docker.container.list '{"query":{"all":true}}'\n`);
		exit(1);
	}

	const method_path = split(ARGV[0], '.');
	if (length(method_path) < 1) {
		die(`Invalid method path: ${ARGV[0]}\n`);
	}

	// Build object path (e.g., "docker.network")
	const obj_parts = slice(method_path, 0, -1);
	const obj_name = join('.', obj_parts);
	const method_name = method_path[length(method_path) - 1];

	if (!methods[obj_name]) {
		die(`Unknown object: ${obj_name}\n`);
	}

	if (!methods[obj_name][method_name]) {
		die(`Unknown method: ${obj_name}.${method_name}\n`);
	}

	// Parse args if provided
	let args = {};
	if (length(ARGV) > 1) {
		try {
			args = json(ARGV[1]);
		} catch (e) {
			die(`Invalid JSON args: ${e}\n`);
		}
	}

	// Call the method
	const request = { args: args };
	const result = methods[obj_name][method_name].call(request);

	// Pretty print result
	print(result, "\n");
	exit(0);
};

return methods;
