#!/usr/bin/env ucode

'use strict';

import { stdin, access, chmod, dirname, basename, open, popen, glob, lsdir, readfile, readlink, error, mkdir } from 'fs';
import { cursor } from 'uci';
import { connect } from 'ubus';


const openvpn_dir = '/etc/openvpn';

/* Key types accepted by "openvpn --genkey". Anything outside this set is
 * rejected, so the value can never introduce shell metacharacters or escape
 * the key directory. */
const keytypes = [
	'secret',
	'tls-crypt',
	'tls-auth',
	'auth-token',
	'tls-crypt-v2-server',
	'tls-crypt-v2-client'
];

function shellquote(s) {
	return `'${replace(s, "'", "'\\''")}'`;
}

/* ifname is a UCI section name, so restrict it to the characters UCI allows.
 * This keeps path separators and ".." out of the generated key paths. */
function is_valid_iface(ifname) {
	return length(ifname) > 0 && match(ifname, /^[a-zA-Z0-9_-]+$/) != null;
}

/* server_key is a plain file name inside the tls-crypt-v2-server directory. */
function is_valid_keyfile(name) {
	return length(name) > 0 && match(name, /^[a-zA-Z0-9._-]+$/) != null && index(name, '..') == -1;
}

function command(cmd) {
	return trim(popen(cmd)?.read?.('all'));
}

function makedirs(path) {
	const parts = split(path, '/');
	const grow = [];
	for(let i = 0; i < length(parts); i++) {
		push(grow, parts[i]);
		mkdir(join('/', grow));
	}
	return join('/', grow);
}

function keyDir(ifname, kt) {
	return `${openvpn_dir}/${ifname}/${kt}`;
}

const methods = {
	generateKey: {
		args: { keytype: 'keytype', ifname: 'ifname', server_key: 'server_key', cl_meta: 'c_metadata' },
		call: function(req) {
			const kt = req.args?.keytype;
			const ifname = req.args?.ifname || 'unnamed';
			const ts = time();

			if (!kt) return { error: 'missing keytype' };
			if (!(kt in keytypes)) return { error: 'invalid keytype' };
			if (!is_valid_iface(ifname)) return { error: 'invalid ifname' };

			let dir;
			let outfile = `${ifname}_${kt}_${ts}.key`;

			let mkpath = makedirs(`${keyDir(ifname, kt)}`);
			let path = `${mkpath}/${outfile}`;

			// find openvpn binary
			const openvpn = trim(popen('command -v openvpn 2>/dev/null')?.read?.('all'));
			if (!length(openvpn)) return { error: 'openvpn binary not found' };

			let cmd;
			if (kt == 'tls-crypt-v2-client') {
				// client generation needs server key
				let server_key = req.args?.server_key;
				if (!server_key) {
					// try to pick latest server key for same interface
					const serverDir = `${keyDir(ifname, 'tls-crypt-v2-server')}`;
					const list = lsdir(serverDir);
					if (length(list) > 0) server_key = serverDir + '/' + list[-1];
				} else {
					if (!is_valid_keyfile(server_key)) return { error: 'invalid server_key' };
					server_key = `${keyDir(ifname, 'tls-crypt-v2-server')}/${server_key}`;
				}

				if (!server_key) return { error: 'missing server_key for tls-crypt-v2-client' };

				// denote which server key this client key is derived from in the name
				path = `${mkpath}/${ifname}_${kt}_${ts}-${basename(server_key)}`;
				cmd = `${openvpn} --tls-crypt-v2 ${shellquote(server_key)} --genkey tls-crypt-v2-client ${shellquote(path)} ${shellquote(req.args?.cl_meta)} 2>/dev/null`;
			} else {
				// basic genkey
				cmd = `${openvpn} --genkey ${shellquote(kt)} ${shellquote(path)} 2>/dev/null`;
			}

			const out = popen(cmd)?.read?.('all') || '';

			// ensure permissions
			chmod(path, 0o600);

			let content = '';
			try { content = readfile(path); } catch (e) { /* ignore */ }

			if (!length(content)) {
				return { error: 'failed to generate key', cmd_output: out };
			}

			return { path, filename: outfile, content };
		}
	},

	getSKeys: {
		args: { ifname: 'ifname' },
		call: function(req) {
			const ifname = req.args?.ifname;

			if (!is_valid_iface(ifname)) return { error: 'invalid ifname' };

			const serverDir = `${keyDir(ifname, 'tls-crypt-v2-server')}`;
			const list = lsdir(serverDir);

			return { skeys: list, path: serverDir };
		}
	}
};

return { 'luci.openvpn': methods };
