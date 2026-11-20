// Docker HTTP streaming endpoint
// Copyright 2025 Paul Donald <newtwen+github@gmail.com>
// Licensed to the public under the Apache License 2.0.
// Built against the docker v1.47 API

'use strict';

import { stdout } from 'fs';
import * as ds from 'luci.docker_socket';
import * as socket from 'socket';
import { cursor } from 'uci';

const BUFF_HEAD = 6; // 8000\r\n
const BUFF_TAIL = 2; // \r\n
const BLOCKSIZE = BUFF_HEAD + 0x8000 + BUFF_TAIL; //sync with Docker chunk size, 32776
// const API_VER = 'v1.47';
const PROTOCOL = 'HTTP/1.1';
const CLIENT_VER = '1';

let DockerController = {

	// Handle file upload for chunked transfer
	handle_file_upload: function(sock) {
		let total_bytes = 0;
		http.setfilehandler(function(meta, chunk, eof) {
			if (meta.file && meta.name === 'upload-archive') {
				if (chunk && length(chunk) > 0) {
					let hex_size = sprintf('%x', length(chunk));
					sock.send(hex_size + '\r\n');
					sock.send(chunk);
					sock.send('\r\n');
					total_bytes += length(chunk);
				}
				if (eof) {
					sock.send('0\r\n\r\n');
				}
			}
		});
		return total_bytes;
	},

	// Reusable header builder
	build_headers: function(headers) {
		let hdrs = [];
		if (headers) {
			for (let key in headers) {
				if (headers[key] != null && headers[key] != '') {
					push(hdrs, `${key}: ${headers[key]}`);
				}
			}
		}
		return length(hdrs) ? join('\r\n', hdrs) : '';
	},

	// Parse the initial HTTP response, split into parts and header lines, and store as properties
	initial_response_parser: function(response_buff) {
		let parts = split(response_buff, /\r?\n\r?\n/, 2);
		let header_lines = split(parts[0], /\r?\n/);
		let status_line = header_lines[0];
		let status_match = match(status_line, /HTTP\/\S+\s+(\d+)/);
		let code = status_match ? int(status_match[1]) : 500;
		this.response_parts = parts;
		this.header_lines = header_lines;
		this.status_line = status_line;
		this.status_match = status_match;
		this.code = code;
	},

	// Stream the rest of the response in chunks from the socket
	stream_response_chunks: function(sock, blocksize) {
		let chunk;
		while ((chunk = sock.recv(blocksize))) {
			if (chunk && length(chunk)) {
				this.debug('Streaming chunk:', substr(chunk, 0, 10));
				stdout.write(chunk);
			}
		}
	},

	// Send a 200 OK response with headers and body
	/* Write CGI response directly to stdout bypassing http.uc
	The minimum to trigger a valid response via CGI is typically
	Status: \r\n

	The Docker response contains the \r\n after its headers, and the browser can
	handle the chunked encoding fine, so we just forward its output verbatim.

	Docker emits a x-docker-container-path-stat header with some meta-data for
	the path, which we forward. uhttpd seems to coalesce headers, and inject its
	own, so we occasionally have two Connection: headers.
	*/
	send_initial_200_response: function(headers, body) {
		stdout.write('Status: 200 OK\r\n');
		if (headers && type(headers) == 'array') {
			stdout.write(join('', headers));
		}

		if (body && index(body, 'HTTP/1.1 200 OK\r\n') === 0) {
			stdout.write(substr(body, length('HTTP/1.1 200 OK\r\n')));
		}
	},

	// Debug output if &debug=... is present
	debug: function(...args) {
		let dbg = http.formvalue('debug');
		let tostr = function(x) { return `${x}`; };
		if (dbg != null && dbg != '') {
			http.prepare_content('application/json');
			http.write_json({msg: join(' ', map(args, tostr)) + '\n' });
		}
	},

	// Generic error response helper
	error_response: function(code, msg, detail) {
		http.status(code ?? 500, msg ?? 'Internal Error');
		http.prepare_content('application/json');
		let out = { error: msg ?? 'Internal Error' };
		if (detail)
			out.detail = detail;
		http.write_json(out);
	},

	get_api_ver: function() {
		let ctx = cursor();
		let version = ctx.get('dockerd', 'globals', 'api_version') || '';
		ctx.unload();
		return version ? `/${version}` : '';
	},

	join_args_array: function(args) {
		return (type(args) == "array") ? join('/', args) : args;
	},

	require_param: function(name) {
		let val = http.formvalue(name);
		if (!val || val == '') die({ code: 400, message: `Missing parameter: ${name}` });
		return val;
	},

	// Reusable query string builder
	build_query_str: function(query_params, skip_keys) {
		let query_str = '';
		if (query_params) {
			let parts = [];
			for (let key in query_params) {
				if (skip_keys && (key in skip_keys))
					continue;
				let val = query_params[key];
				if (val == null || val == '') continue;
				if (type(val) === 'array') {
					for (let v in val) {
						push(parts, `${key}=${v}`);
					}
				} else {
					push(parts, `${key}=${val}`);
				}
			}
			if (length(parts))
				query_str = '?' + join('&', parts);
		}
		return query_str;
	},

	get_archive: function(docker_path, id, docker_function, query_params, archive_name) {
		this.debug('get_archive called', docker_path, id, docker_function, query_params, archive_name);
		id = this.join_args_array(id);
		let id_param = '';
		if (id) id_param = `/${id}`;

		const sock_dest = ds.get_socket_dest_compat();
		const sock = socket.create(sock_dest.family, socket.SOCK_STREAM);

		this.debug('Socket created:', !!sock);

		if (!sock) {
			this.debug('Socket creation failed');
			this.error_response(500, 'Failed to create socket');
			return;
		}

		if (!sock.connect(sock_dest)) {
			this.debug('Socket connect failed');
			sock.close();
			this.error_response(503, 'Failed to connect to Docker daemon');
			return;
		}

		let query_str = type(query_params) === 'object' ? this.build_query_str(query_params) : `?${query_params}`;
		let url = `${docker_path}${id_param}${docker_function}${query_str}`;
		let req = [
			`GET ${this.get_api_ver()}${url} ${PROTOCOL}`,
			`Host: openwrt-docker-ui`,
			`User-Agent: luci-app-dockerman-rpc-ucode/${CLIENT_VER}`,
			`Connection: close`,
			``,
			``
		];

		this.debug('Sending request:', req);
		sock.send(join('\r\n', req));

		let response_buff = sock.recv(BLOCKSIZE);
		this.debug('Received response header block:', response_buff ? substr(response_buff, 0, 100) : 'null');
		if (!response_buff || response_buff == '') {
			this.debug('No response from Docker daemon');
			sock.close();
			this.error_response(500, 'No response from Docker daemon');
			return;
		}

		this.initial_response_parser(response_buff);

		if (this.code != 200) {
			this.debug('Docker error status:', this.code, this.status_line);
			sock.close();
			this.error_response(this.code, 'Docker Error', this.status_line);
			return;
		}

		let filename = length(id) >= 64 ? substr(id, 0, 12) : id;
		if (!filename) filename = 'multi';
		let include_headers = [`Content-Disposition: attachment; filename=\"${filename}_${archive_name}\"\r\n`];

		this.send_initial_200_response(include_headers, response_buff);
		this.stream_response_chunks(sock, BLOCKSIZE);

		sock.close();
		return;
	},

	docker_send: function(method, docker_path, docker_function, query_params, headers, haveFile) {
		this.debug('docker_send called', method, docker_path, docker_function, query_params, headers, haveFile);
		const sock_dest = ds.get_socket_dest_compat();
		const sock = socket.create(sock_dest.family, socket.SOCK_STREAM);

		this.debug('Socket created:', !!sock);

		if (!sock) {
			this.debug('Socket creation failed');
			this.error_response(500, 'Failed to create socket');
			return;
		}

		if (!sock.connect(sock_dest)) {
			this.debug('Socket connect failed');
			sock.close();
			this.error_response(503, 'Failed to connect to Docker daemon');
			return;
		}

		let skip_keys = {
			token: true,
			'X-Registry-Auth': true,
			'upload-name': true,
			'upload-archive': true,
			'upload-path': true,
		};

		let remote = false;

		if (query_params && type(query_params) === 'object' &&
			query_params['remote'] != null && query_params['remote'] != '')
			remote = true;

		let query_str = type(query_params) === 'object' ? this.build_query_str(query_params, skip_keys) : `?${query_params}`;

		let hdr_str = this.build_headers(headers);

		let url = `${docker_path}${docker_function}${query_str}`;

		let req = [
			`${method} ${this.get_api_ver()}${url} ${PROTOCOL}`,
			`Host: openwrt-docker-ui`,
			`User-Agent: luci-app-docker-controller-ucode/${CLIENT_VER}`,
			`Connection: close`,
		];

		if (hdr_str)
			push(req, hdr_str);
		if (haveFile) {
			push(req, 'Content-Type: application/x-tar');
			push(req, 'Transfer-Encoding: chunked');
		}
		push(req, '');
		push(req, '');

		this.debug('Sending request:', req);
		sock.send(join('\r\n', req));

		if (haveFile)
			this.handle_file_upload(sock);
		else
			sock.send('\r\n\r\n');

		let response_buff = sock.recv(BLOCKSIZE);
		this.debug('Received response header block:', response_buff ? substr(response_buff, 0, 100) : 'null');
		if (!response_buff || response_buff == '') {
			this.debug('No response from Docker daemon');
			sock.close();
			this.error_response(500, 'No response from Docker daemon');
			return;
		}

		this.initial_response_parser(response_buff);
		if (this.code != 200) {
			this.debug('Docker error status:', this.code, this.status_line);
			sock.close();
			this.error_response(this.code, 'Docker Error', this.status_line);
			return;
		}

		this.send_initial_200_response('', response_buff);
		this.stream_response_chunks(sock, BLOCKSIZE);
		sock.close();
		return;
	},

	// Handler methods
	container_get_archive: function(id) {
		this.require_param('path');
		this.get_archive('/containers', id, '/archive', http.message.env.QUERY_STRING, 'file_archive.tar');
	},

	container_export: function(id) {
		this.get_archive('/containers', id, '/export', null, 'container_export.tar');
	},

	containers_prune: function() {
		this.docker_send('POST', '/containers', '/prune', http.message.env.QUERY_STRING, {}, false);
	},

	container_put_archive: function(id) {
		this.require_param('path');
		this.docker_send('PUT', '/containers', `/${id}/archive`, http.message.env.QUERY_STRING, {}, true);
	},

	docker_events: function() {
		this.docker_send('GET', '', '/events', http.message.env.QUERY_STRING, {}, false);
	},

	image_build: function(...args) {
		let remote = http.formvalue('remote');
		this.docker_send('POST', '', '/build', http.message.env.QUERY_STRING, {}, !remote);
	},

	image_build_prune: function() {
		this.docker_send('POST', '/build', '/prune', http.message.env.QUERY_STRING, {}, false);
	},

	image_create: function() {
		let headers = {
			'X-Registry-Auth': http.formvalue('X-Registry-Auth'),
		};
		this.docker_send('POST', '/images', '/create', http.message.env.QUERY_STRING, headers, false);
	},

	image_get: function(...args) {
		this.get_archive('/images', args, '/get', http.message.env.QUERY_STRING, 'image_export.tar');
	},

	image_load: function() {
		this.docker_send('POST', '/images', '/load', http.message.env.QUERY_STRING, {}, true);
	},

	images_prune: function() {
		this.docker_send('POST', '/images', '/prune', http.message.env.QUERY_STRING, {}, false);
	},

	image_push: function(...args) {
		let headers = {
			'X-Registry-Auth': http.formvalue('X-Registry-Auth'),
		};
		this.docker_send('POST', `/images/${this.join_args_array(args)}`, '/push', http.message.env.QUERY_STRING, headers, false);
	},

	networks_prune: function() {
		this.docker_send('POST', '/networks', '/prune', http.message.env.QUERY_STRING, {}, false);
	},

	volumes_prune: function() {
		this.docker_send('POST', '/volumes', '/prune', http.message.env.QUERY_STRING, {}, false);
	},
};

// Export all handlers with automatic error wrapping
let controller = DockerController;
let exports = {};
for (let k, v in controller) {
	if (type(v) == 'function')
		exports[k] = v;
}

return exports;
