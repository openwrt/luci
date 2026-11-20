#!/usr/bin/env ucode
'use strict';

import { access, lstat, readfile, unlink, rename, chmod, chown, mkdir, mkdtemp, open, popen } from 'fs';
import { cursor } from 'uci';

/*
 * The weechat init script keeps /etc/weechat and /etc/weechat/tls owned by
 * root and not writable by the daemon. Certificates are only written there,
 * so the daemon cannot redirect any of the paths used below.
 */
const BASE_DIR = '/etc/weechat';
const TLS_DIR = BASE_DIR + '/tls';
const DEFAULT_CERT = TLS_DIR + '/relay.pem';

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

/* Without the s flag, ^ and $ also match at line breaks, so reject them first */
function single_line(val) {
	return type(val) == 'string' && index(val, '\n') < 0 && index(val, '\r') < 0;
}

function valid_cert_path(path) {
	return single_line(path) &&
	       match(path, /^\/etc\/weechat\/tls\/[a-zA-Z0-9._-]+\.pem$/) &&
	       index(path, '..') < 0;
}

function root_owned_dir(path) {
	let st = lstat(path);
	return !!(st && st.type == 'directory' && st.uid == 0 && !(st.mode & 0022));
}

function normalize_san(entry) {
	if (!single_line(entry))
		return null;

	let item = trim(entry);
	if (!length(item))
		return null;

	let kind = null;
	if (match(item, /^IP:/i)) {
		kind = 'IP';
		item = trim(substr(item, 3));
	} else if (match(item, /^DNS:/i)) {
		kind = 'DNS';
		item = trim(substr(item, 4));
	}

	let ip = (kind != 'DNS') ? iptoarr(item) : null;
	if (ip)
		return { type: 'IP', value: arrtoip(ip), bytes: ip };
	if (kind == 'IP')
		return null;

	if (match(item, /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/))
		return { type: 'DNS', value: item };

	return null;
}

/* DER encoding of a SAN entry, GeneralName [7] for IP and [2] for DNS */
function san_der(san) {
	let bytes = (san.type == 'IP') ? san.bytes : map(split(san.value, ''), (c) => ord(c));
	let tag = (san.type == 'IP') ? 0x87 : 0x82;
	let hdr = (length(bytes) < 128) ? [ tag, length(bytes) ] : [ tag, 0x81, length(bytes) ];
	return chr(...hdr, ...bytes);
}

/*
 * px5g-mbedtls up to PKG_RELEASE 11 writes every IP entry with a length of
 * 16 bytes, so an IPv4 entry turns into a wrong IPv6 address, and other px5g
 * builds might ignore -addext. Look for each SAN entry in the certificate.
 */
function cert_has_sans(cert_pem, sans) {
	let der = b64dec(replace(cert_pem, /-----[A-Z ]+-----|[ \t\r\n]/g, ''));
	if (der == null)
		return false;

	for (let san in sans)
		if (index(der, san_der(san)) < 0)
			return false;
	return true;
}

function cleanup_temp_dir(tmp_dir) {
	if (tmp_dir && match(tmp_dir, /^\/tmp\/weechat-cert\.[A-Za-z0-9]+$/)) {
		system(['rm', '-rf', tmp_dir]);
	}
}

function failure(msg) {
	return { success: false, error: msg };
}

/* Whether the saved config makes the relay use this certificate */
function cert_in_use(path) {
	let ctx = cursor();
	return ctx.get('weechat', 'weechat', 'relay_enabled') == '1' &&
	       ctx.get('weechat', 'weechat', 'relay_tls') == '1' &&
	       (ctx.get('weechat', 'weechat', 'relay_cert_key') || DEFAULT_CERT) == path;
}

const methods = {
	/*
	 * The init script only starts WeeChat with option enabled '1'. Commit
	 * just that option, LuCI itself can only apply all staged changes.
	 */
	enable_service: {
		call: function(req) {
			let ctx = cursor();
			if (!ctx.get('weechat', 'weechat'))
				ctx.set('weechat', 'weechat', 'weechat');
			ctx.set('weechat', 'weechat', 'enabled', '1');
			return { success: !!ctx.commit('weechat') };
		}
	},
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
			let path = req?.args?.path || DEFAULT_CERT;
			if (!valid_cert_path(path)) {
				return {
					exists: false,
					error: 'Invalid path. Must be located under /etc/weechat/tls/.'
				};
			}

			let tool_available = !!(find_px5g() || find_openssl());

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

			return {
				exists: true,
				path: path,
				readable: true,
				has_key: !!match(content, /-----BEGIN ([A-Z0-9]+ )?PRIVATE KEY-----/),
				has_cert: !!match(content, /-----BEGIN CERTIFICATE-----/),
				generator_available: tool_available
			};
		}
	},

	generate_certificate: {
		args: { cn: 'cn', san: 'san', path: 'path' },
		call: function(req) {
			let args = req?.args || {};
			let path = args.path || DEFAULT_CERT;

			if (!valid_cert_path(path))
				return failure('Invalid target path. Must be located under /etc/weechat/tls/.');

			let cn = (type(args.cn) == 'string') ? trim(args.cn) : '';
			if (!length(cn)) {
				cn = 'OpenWrt';
			}
			/* ':' allows an IPv6 address, which the dialog pre-fills over IPv6 */
			if (!single_line(cn) || !match(cn, /^[a-zA-Z0-9.:_-]+$/))
				return failure('Invalid Common Name format.');

			let san_raw = args.san;
			let san_list = [];
			if (type(san_raw) == 'array') {
				san_list = san_raw;
			} else if (type(san_raw) == 'string') {
				san_list = split(san_raw, ',');
			}

			let sans = [];
			for (let entry in san_list) {
				if (type(entry) != 'string' || !length(trim(entry)))
					continue;
				let san = normalize_san(entry);
				if (!san)
					return failure('Invalid Subject Alternative Name (SAN): ' + trim(entry));
				push(sans, san);
			}

			let px5g_bin = find_px5g();
			let openssl_bin = find_openssl();

			if (!px5g_bin && !openssl_bin)
				return failure('Neither px5g nor openssl certificate generator is installed.');

			/*
			 * A certificate needs at least one SAN, default to the CN. px5g-wolfssl
			 * cannot add any, it puts the CN in as a DNS name itself.
			 */
			let with_san = !!(openssl_bin || px5g_supports_addext(px5g_bin));
			if (!length(sans) && with_san) {
				let san = normalize_san(cn);
				if (!san)
					return failure('Please enter a Subject Alternative Name.');
				push(sans, san);
			}

			if (!root_owned_dir(BASE_DIR))
				return failure(BASE_DIR + ' must be a directory owned by root. Restart the WeeChat service to fix its permissions.');

			if (!lstat(TLS_DIR)) {
				if (!mkdir(TLS_DIR, 0755) || !chown(TLS_DIR, 0, 0) || !chmod(TLS_DIR, 0755))
					return failure('Failed to create directory: ' + TLS_DIR);
			}
			if (!root_owned_dir(TLS_DIR))
				return failure(TLS_DIR + ' must be a directory owned by root.');

			let st_path = lstat(path);
			if (st_path && st_path.type != 'file')
				return failure('Target exists and is not a regular file: ' + path);

			let tmp_dir = mkdtemp('/tmp/weechat-cert.XXXXXX');
			if (!tmp_dir)
				return failure('Failed to create secure temporary directory.');

			let key_file = tmp_dir + '/key.pem';
			let cert_file = tmp_dir + '/cert.pem';
			let subj = sprintf('/C=ZZ/ST=Somewhere/L=Unknown/O=OpenWrt/CN=%s', cn);
			/*
			 * rpcd waits for this call, so use an EC key: generating an RSA
			 * key can block it for a long time on slow routers.
			 */
			let key_opts = [ '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:P-256' ];
			let used_px5g = false;
			let cmd;

			if (openssl_bin) {
				let san_str = join(',', map(sans, (san) => san.type + ':' + san.value));

				cmd = [
					openssl_bin, 'req', '-x509', '-nodes',
					'-days', '397',
					...key_opts,
					'-keyout', key_file,
					'-out', cert_file,
					'-subj', subj,
					'-addext', 'extendedKeyUsage=serverAuth',
					'-addext', 'subjectAltName=' + san_str
				];
			} else if (px5g_supports_addext(px5g_bin)) {
				cmd = [
					px5g_bin, 'selfsigned',
					'-days', '397',
					...key_opts,
					'-keyout', key_file,
					'-out', cert_file,
					'-subj', subj,
					'-addext', 'extendedKeyUsage=serverAuth'
				];
				// Keep the subjectAltName options last, older px5g-mbedtls
				// hangs when any other option follows one of them.
				for (let san in sans)
					push(cmd, '-addext', 'subjectAltName=' + san.type + ':' + san.value);
				used_px5g = true;
			} else {
				if (length(sans) > 0) {
					cleanup_temp_dir(tmp_dir);
					return failure('The installed px5g (WolfSSL) does not support Subject Alternative Names (-addext). Please install openssl-util or px5g-mbedtls.');
				}
				/* It would put the address in as a DNS name, which no client accepts */
				if (iptoarr(cn)) {
					cleanup_temp_dir(tmp_dir);
					return failure('The installed px5g (WolfSSL) cannot put an IP address into a certificate. Please install openssl-util or px5g-mbedtls, or use a host name as Common Name.');
				}
				cmd = [
					px5g_bin, 'selfsigned',
					'-days', '397',
					...key_opts,
					'-keyout', key_file,
					'-out', cert_file,
					'-subj', subj
				];
			}

			let ret = system(cmd);
			let key_content = (ret == 0) ? readfile(key_file) : null;
			let cert_content = (ret == 0) ? readfile(cert_file) : null;
			cleanup_temp_dir(tmp_dir);

			if (!key_content || !cert_content)
				return failure('Certificate generation failed.');

			if (used_px5g && !cert_has_sans(cert_content, sans)) {
				if (length(filter(sans, (san) => san.type == 'IP')))
					return failure('The installed px5g writes invalid IP addresses into certificates. Please install openssl-util, update px5g-mbedtls or use host names only.');
				return failure('The installed px5g did not write the Subject Alternative Names. Please install openssl-util or px5g-mbedtls.');
			}

			let combined = key_content;
			if (substr(combined, -1) != '\n') {
				combined += '\n';
			}
			combined += cert_content;

			// Readable by the daemon, but only root can replace it
			let tmp_file = path + '.tmp';
			unlink(tmp_file);

			let f = open(tmp_file, 'wx', 0640);
			if (!f)
				return failure('Failed to write certificate bundle.');
			let written = f.write(combined);
			f.close();

			if (written != length(combined) ||
			    !chown(tmp_file, 'root', 'weechat') ||
			    !chmod(tmp_file, 0640) ||
			    !rename(tmp_file, path)) {
				unlink(tmp_file);
				return failure('Failed to install certificate to: ' + path);
			}

			return {
				success: true,
				path: path,
				in_use: cert_in_use(path),
				message: 'Certificate generated successfully.'
			};
		}
	}
};

return { 'weechat': methods };
