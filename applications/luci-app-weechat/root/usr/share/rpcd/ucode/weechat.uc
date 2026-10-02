#!/usr/bin/env ucode
'use strict';

import { access, stat, lstat, readfile, unlink, dirname, rename, chmod, open, popen } from 'fs';

function find_px5g() {
	if (access('/usr/sbin/px5g', 'x')) {
		return '/usr/sbin/px5g';
	}
	if (access('/usr/bin/px5g', 'x')) {
		return '/usr/bin/px5g';
	}
	return null;
}

function find_openssl() {
	if (access('/usr/bin/openssl', 'x')) {
		return '/usr/bin/openssl';
	}
	return null;
}

function px5g_supports_addext(px5g_bin) {
	if (!px5g_bin)
		return false;
	let p = popen(px5g_bin + ' 2>&1', 'r');
	let out = p ? p.read('all') : '';
	if (p)
		p.close();
	// px5g-wolfssl outputs: "PX5G X.509 Certificate Generator Utilit using WolfSSL"
	// and does not support -addext
	if (index(out, 'WolfSSL') >= 0)
		return false;
	return true;
}

function valid_cert_path(path) {
	return (type(path) == 'string') &&
	       match(path, /^\/etc\/weechat\/tls\/[a-zA-Z0-9._-]+\.pem$/) &&
	       index(path, '..') < 0;
}

function check_path_components(path) {
	let parts = split(path, '/');
	let cur = '';
	for (let i = 0; i < length(parts) - 1; i++) {
		if (parts[i] == '') {
			cur = '/';
			continue;
		}
		cur = (cur == '/' ? '' : cur) + '/' + parts[i];
		let st = lstat(cur);
		if (st) {
			if (st.type == 'symlink') {
				return {
					valid: false,
					error: 'Path component cannot be a symlink: ' + cur
				};
			}
		}
	}
	return { valid: true };
}

function normalize_san(entry) {
	let item = trim(entry);
	if (!length(item))
		return null;

	let type = null;
	let val = null;

	if (match(item, /^IP:/i)) {
		type = 'IP';
		val = substr(item, 3);
	} else if (match(item, /^DNS:/i)) {
		type = 'DNS';
		val = substr(item, 4);
	} else {
		val = item;
		if (match(val, /^([0-9]{1,3}\.){3}[0-9]{1,3}$/)) {
			type = 'IP';
		} else if (match(val, /^[0-9a-fA-F:]+$/) && index(val, ':') >= 0) {
			type = 'IP';
		} else {
			type = 'DNS';
		}
	}

	val = trim(val);
	if (!length(val))
		return null;

	if (type == 'IP') {
		if (match(val, /^([0-9]{1,3}\.){3}[0-9]{1,3}$/)) {
			let parts = split(val, '.');
			for (let p in parts) {
				let n = int(p);
				if (n < 0 || n > 255)
					return null;
			}
			return 'IP:' + val;
		}
		if (match(val, /^[0-9a-fA-F:]+$/) && index(val, ':') >= 0) {
			if (length(val) <= 39 && !match(val, /:::/)) {
				return 'IP:' + val;
			}
		}
		return null;
	}

	if (type == 'DNS') {
		if (match(val, /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/)) {
			return 'DNS:' + val;
		}
		return null;
	}

	return null;
}

function create_temp_dir() {
	let p = popen('mktemp -d /tmp/weechat-cert.XXXXXX 2>/dev/null', 'r');
	let tmp_dir = trim(p ? p.read('line') : '');
	if (p)
		p.close();

	if (!length(tmp_dir) || !match(tmp_dir, /^\/tmp\/weechat-cert\.[A-Za-z0-9]+$/))
		return null;

	let st = lstat(tmp_dir);
	if (!st || st.type != 'directory')
		return null;

	chmod(tmp_dir, 0700);
	return tmp_dir;
}

function cleanup_temp_dir(tmp_dir) {
	if (tmp_dir && match(tmp_dir, /^\/tmp\/weechat-cert\.[A-Za-z0-9]+$/)) {
		system(['rm', '-rf', tmp_dir]);
	}
}

const methods = {
	get_daemon_info: {
		call: function(req) {
			let version = null;
			let p = popen('/usr/bin/weechat-headless -v 2>/dev/null', 'r');
			if (p) {
				version = trim(p.read('all'));
				p.close();
			}
			if (!length(version)) {
				p = popen('/usr/bin/weechat -v 2>/dev/null', 'r');
				if (p) {
					version = trim(p.read('all'));
					p.close();
				}
			}
			return {
				version: length(version) ? version : null
			};
		}
	},
	get_certificate_status: {
		args: { path: 'path' },
		call: function(req) {
			let path = req?.args?.path || '/etc/weechat/tls/relay.pem';
			if (!valid_cert_path(path)) {
				return {
					exists: false,
					error: 'Invalid path. Must be located under /etc/weechat/tls/.'
				};
			}

			let px5g_bin = find_px5g();
			let openssl_bin = find_openssl();
			let tool_available = !!(px5g_bin || openssl_bin);

			let st = lstat(path);
			if (!st || st.type != 'file' || st.size == 0) {
				return {
					exists: false,
					path: path,
					generator_available: tool_available
				};
			}

			let content = readfile(path);
			if (!content) {
				return {
					exists: true,
					path: path,
					readable: false,
					generator_available: tool_available
				};
			}

			let has_key = !!match(content, /-----BEGIN (?:[A-Z0-9 ]+)?PRIVATE KEY-----/);
			let has_cert = !!match(content, /-----BEGIN CERTIFICATE-----/);

			return {
				exists: true,
				path: path,
				readable: true,
				has_key: has_key,
				has_cert: has_cert,
				generator_available: tool_available
			};
		}
	},

	generate_certificate: {
		args: { cn: 'cn', san: 'san', path: 'path' },
		call: function(req) {
			let args = req?.args || {};
			let path = args.path || '/etc/weechat/tls/relay.pem';

			if (!valid_cert_path(path)) {
				return {
					success: false,
					error: 'Invalid target path. Must be located under /etc/weechat/tls/.'
				};
			}

			let cn = trim(args.cn || '');
			if (!length(cn)) {
				cn = 'OpenWrt';
			}
			if (!match(cn, /^[a-zA-Z0-9._-]+$/)) {
				return {
					success: false,
					error: 'Invalid Common Name format.'
				};
			}

			let san_raw = args.san;
			let san_list = [];
			if (type(san_raw) == 'array') {
				san_list = san_raw;
			} else if (type(san_raw) == 'string') {
				san_list = split(san_raw, ',');
			}

			let san_normalized = [];
			for (let entry in san_list) {
				let norm = normalize_san(entry);
				if (!norm) {
					let trimmed = trim(entry);
					if (length(trimmed)) {
						return {
							success: false,
							error: 'Invalid Subject Alternative Name (SAN): ' + trimmed
						};
					}
					continue;
				}
				push(san_normalized, norm);
			}

			let px5g_bin = find_px5g();
			let openssl_bin = find_openssl();

			if (!px5g_bin && !openssl_bin) {
				return {
					success: false,
					error: 'Neither px5g nor openssl certificate generator is installed.'
				};
			}

			let chk = check_path_components(path);
			if (!chk.valid) {
				return {
					success: false,
					error: chk.error
				};
			}

			let dir = dirname(path);
			let st_dir = lstat(dir);

			if (st_dir) {
				if (st_dir.type != 'directory') {
					return {
						success: false,
						error: 'Target directory path is not a directory: ' + dir
					};
				}
				if (st_dir.uid != 0) {
					return {
						success: false,
						error: 'Target directory must be owned by root: ' + dir
					};
				}
			} else {
				let ret_mkdir = system(['mkdir', '-p', dir]);
				if (ret_mkdir != 0) {
					return {
						success: false,
						error: 'Failed to create directory: ' + dir
					};
				}
				if (!chmod(dir, 0755)) {
					return {
						success: false,
						error: 'Failed to set permissions on directory: ' + dir
					};
				}
				let ret_chown_dir = system(['chown', 'root:root', dir]);
				if (ret_chown_dir != 0) {
					return {
						success: false,
						error: 'Failed to set ownership on directory: ' + dir
					};
				}
				let st_verify = lstat(dir);
				if (!st_verify || st_verify.type != 'directory' || st_verify.uid != 0) {
					return {
						success: false,
						error: 'Failed to securely verify directory: ' + dir
					};
				}
			}

			let st_path = lstat(path);
			if (st_path && st_path.type == 'symlink') {
				return {
					success: false,
					error: 'Target file cannot be a symlink: ' + path
				};
			}

			let tmp_dir = create_temp_dir();
			if (!tmp_dir) {
				return {
					success: false,
					error: 'Failed to create secure temporary directory.'
				};
			}

			let key_file = tmp_dir + '/key.pem';
			let cert_file = tmp_dir + '/cert.pem';

			let px5g_has_addext = px5g_supports_addext(px5g_bin);
			let gen_success = false;

			if (px5g_bin && px5g_has_addext) {
				let cmd = [
					px5g_bin, 'selfsigned',
					'-days', '397',
					'-newkey', 'rsa:2048',
					'-keyout', key_file,
					'-out', cert_file,
					'-subj', sprintf('/C=ZZ/ST=Somewhere/L=Unknown/O=OpenWrt/CN=%s', cn),
					'-addext', 'extendedKeyUsage=serverAuth'
				];
				for (let item in san_normalized) {
					push(cmd, '-addext', 'subjectAltName=' + item);
				}
				let ret = system(cmd);
				gen_success = (ret == 0);
			} else if (openssl_bin) {
				let san_items = [];
				for (let item in san_normalized) {
					push(san_items, item);
				}
				let san_str = length(san_items) ? join(',', san_items) : ('DNS:' + cn);

				let cmd = [
					openssl_bin, 'req', '-x509', '-nodes',
					'-days', '397',
					'-newkey', 'rsa:2048',
					'-keyout', key_file,
					'-out', cert_file,
					'-subj', sprintf('/C=ZZ/ST=Somewhere/L=Unknown/O=OpenWrt/CN=%s', cn),
					'-addext', 'extendedKeyUsage=serverAuth',
					'-addext', 'subjectAltName=' + san_str
				];
				let ret = system(cmd);
				gen_success = (ret == 0);
			} else if (px5g_bin) {
				if (length(san_normalized) > 0) {
					cleanup_temp_dir(tmp_dir);
					return {
						success: false,
						error: 'The installed px5g (WolfSSL) does not support Subject Alternative Names (-addext). Please install openssl-util or px5g-mbedtls.'
					};
				}
				let cmd = [
					px5g_bin, 'selfsigned',
					'-days', '397',
					'-newkey', 'rsa:2048',
					'-keyout', key_file,
					'-out', cert_file,
					'-subj', sprintf('/C=ZZ/ST=Somewhere/L=Unknown/O=OpenWrt/CN=%s', cn)
				];
				let ret = system(cmd);
				gen_success = (ret == 0);
			}

			if (!gen_success || !stat(key_file) || !stat(cert_file)) {
				cleanup_temp_dir(tmp_dir);
				return {
					success: false,
					error: 'Certificate generation failed.'
				};
			}

			let key_content = readfile(key_file);
			let cert_content = readfile(cert_file);
			cleanup_temp_dir(tmp_dir);

			if (!key_content || !cert_content) {
				return {
					success: false,
					error: 'Failed to read generated key or certificate.'
				};
			}

			let combined = key_content;
			if (substr(combined, -1) != '\n') {
				combined += '\n';
			}
			combined += cert_content;

			let p_tmp = popen('mktemp /etc/weechat/tls/.tmp-cert.XXXXXX 2>/dev/null', 'r');
			let tmp_file = trim(p_tmp ? p_tmp.read('line') : '');
			if (p_tmp)
				p_tmp.close();

			if (!length(tmp_file) || !match(tmp_file, /^\/etc\/weechat\/tls\/\.tmp-cert\.[A-Za-z0-9]+$/)) {
				return {
					success: false,
					error: 'Failed to create temporary file in ' + dir
				};
			}

			let st_tmp = lstat(tmp_file);
			if (!st_tmp || st_tmp.type != 'file') {
				unlink(tmp_file);
				return {
					success: false,
					error: 'Temporary file verification failed in ' + dir
				};
			}

			let f = open(tmp_file, 'w', 0600);
			if (!f) {
				unlink(tmp_file);
				return {
					success: false,
					error: 'Failed to write certificate bundle.'
				};
			}
			let written = f.write(combined);
			f.close();

			if (written != length(combined)) {
				unlink(tmp_file);
				return {
					success: false,
					error: 'Failed to write complete certificate bundle.'
				};
			}

			if (!chmod(tmp_file, 0600)) {
				unlink(tmp_file);
				return {
					success: false,
					error: 'Failed to set permissions on certificate file.'
				};
			}

			let ret_chown_file = system(['chown', 'weechat:weechat', tmp_file]);
			if (ret_chown_file != 0) {
				unlink(tmp_file);
				return {
					success: false,
					error: 'Failed to set ownership on certificate file.'
				};
			}

			let chk_final = check_path_components(path);
			if (!chk_final.valid) {
				unlink(tmp_file);
				return {
					success: false,
					error: chk_final.error
				};
			}

			let st_dest = lstat(path);
			if (st_dest && st_dest.type == 'symlink') {
				unlink(tmp_file);
				return {
					success: false,
					error: 'Target file cannot be a symlink: ' + path
				};
			}

			if (!rename(tmp_file, path)) {
				unlink(tmp_file);
				return {
					success: false,
					error: 'Failed to install certificate to: ' + path
				};
			}

			chmod(path, 0600);
			system(['chown', 'weechat:weechat', path]);

			return {
				success: true,
				path: path,
				message: 'Certificate generated successfully.'
			};
		}
	}
};

return { 'weechat': methods };
