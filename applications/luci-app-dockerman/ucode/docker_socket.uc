
// Copyright 2025 Paul Donald / luci-lib-docker-js
// Licensed to the public under the Apache License 2.0.
// Built against the docker v1.47 API

import { cursor } from 'uci';
import * as socket from 'socket';

/**
 * Get the Docker socket path from uci config, more backwards compatible.
 */
export function get_socket_dest_compat() {
	const ctx = cursor();
	let sock_entry = ctx.get_first('dockerd', 'globals', 'hosts')?.[0] || '/var/run/docker.sock';
	ctx.unload();

	sock_entry = lc(sock_entry);
	/* start ucode 2025-12-01 compatibility */
	let sock_split, addr = sock_entry, proto, proto_num, port = 0;
	let family;

	if (index(sock_entry, '://') != -1) {
		let sock_split = split(lc(sock_entry), '://', 2);
		addr = sock_split?.[1];
		proto = sock_split?.[0];
	} 
	if (index(addr, '/') != -1) {
		// we got '/var/run/docker.sock' format
		return socket.sockaddr(addr);
	}

	if (proto === 'tcp' || proto === 'udp' || proto === 'inet') {
		family = socket.AF_INET;
		if (proto === 'tcp')
			proto_num = socket.IPPROTO_TCP;
		else if (proto === 'udp')
			proto_num =  socket.IPPROTO_UDP;
	}
	else if (proto === 'tcp6' || proto === 'udp6' || proto === 'inet6') {
		family = socket.AF_INET6;
		if (proto === 'tcp6')
			proto_num = socket.IPPROTO_TCP;
		else if (proto === 'udp6')
			proto_num =  socket.IPPROTO_UDP;
	}
	else if (proto === 'unix')
		family = socket.AF_UNIX;
	else {
		family = socket.AF_INET; // ipv4
		proto_num = socket.IPPROTO_TCP; // tcp
	}

	let host = addr;
	const l_bracket = index(host, '[');
	const r_bracket = rindex(host, ']');
	if (l_bracket != -1 && r_bracket != -1) {
		host = substr(host, l_bracket + 1, r_bracket - 1);
		family = socket.AF_INET6;
	}

	// find port based on addr, otherwise we find ':' in IPv6
	const port_index = rindex(addr, ':');
	if (port_index != -1) {
		port = int(substr(addr, port_index + 1)) || 0;
		host = substr(host, 0, port_index);
	}

	const sock = socket.addrinfo(host, port, {protocol: proto_num});

	return socket.sockaddr(sock[0].addr);
	// return {family: family, address: host, port: port};
};


/**
 * Get the Docker socket path from uci config
 */
export function get_socket_dest() {

	const ctx = cursor();
	let sock_entry = ctx.get_first('dockerd', 'globals', 'hosts')?.[0] || '/var/run/docker.sock';
	sock_entry = lc(sock_entry);
	let sock_addr = split(sock_entry, '://', 2)?.[1] ?? sock_entry;
	ctx.unload();

	return sock_addr;
};
