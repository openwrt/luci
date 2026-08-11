'use strict';
'require baseclass';

function decodeLabel(value) {
	try { return decodeURIComponent(value || ''); } catch (e) { return value || ''; }
}

function decodeBase64(value) {
	var normalized = value.replace(/-/g, '+').replace(/_/g, '/').replace(/\s+/g, '');
	while (normalized.length % 4) normalized += '=';
	var binary = atob(normalized), bytes = new Uint8Array(binary.length);
	for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return new TextDecoder('utf-8').decode(bytes);
}

function truthy(value) {
	return /^(1|true|yes)$/i.test(value || '') ? '1' : '0';
}

function common(protocol, url) {
	if (!url.hostname || !url.port) throw new Error(_('Server and port are required'));
	return {
		enabled: '1', protocol: protocol, server: url.hostname, port: url.port,
		label: decodeLabel(url.hash.replace(/^#/, '')) || protocol.toUpperCase() + ' ' + url.hostname
	};
}

function parseUrl(uri, protocol) {
	var url = new URL(uri), p = url.searchParams, out = common(protocol, url);
	if (protocol === 'anytls' || protocol === 'hysteria2' || protocol === 'trojan') {
		out.password = decodeURIComponent(url.username || '');
		out.sni = p.get('peer') || p.get('sni') || '';
		out.insecure = truthy(p.get('insecure') || p.get('allowInsecure'));
		out.alpn = p.get('alpn') || '';
		out.pin_sha256 = p.get('pinSHA256') || '';
		out.fingerprint = p.get('fingerprint') || p.get('fp') || '';
		out.udp = truthy(p.get('udp'));
	} else if (protocol === 'tuic') {
		out.uuid = decodeURIComponent(url.username || '');
		out.password = decodeURIComponent(url.password || '');
		out.sni = p.get('sni') || '';
		out.insecure = truthy(p.get('insecure') || p.get('allowInsecure') || p.get('allow_insecure'));
		out.alpn = p.get('alpn') || '';
		out.congestion = p.get('congestion_control') || p.get('congestion') || 'bbr';
		out.udp_mode = p.get('udp_relay_mode') || 'native';
	} else if (protocol === 'vless') {
		out.uuid = decodeURIComponent(url.username || '');
		out.flow = p.get('flow') || '';
		out.security = p.get('security') || '';
		out.sni = p.get('sni') || '';
		out.public_key = p.get('pbk') || p.get('publicKey') || '';
		out.short_id = p.get('sid') || p.get('shortId') || '';
		out.fingerprint = p.get('fp') || p.get('fingerprint') || 'chrome';
		if (p.get('type') === 'ws') {
			out.transport = 'ws'; out.path = p.get('path') || '/'; out.host = p.get('host') || '';
		}
	} else if (protocol === 'wireguard') {
		// wg://<peer_public_key>@<server>:<port>?private_key=…&local_address=…&reserved=…&mtu=…
		out.public_key = decodeURIComponent(url.username || '');
		out.private_key = p.get('private_key') || '';
		out.local_address = (p.get('local_address') || p.get('ip') || '').split(',')[0] || '';
		out.reserved = p.get('reserved') || '';
		out.mtu = p.get('mtu') || '';
	}
	return out;
}

function parseVmess(uri) {
	var raw = JSON.parse(decodeBase64(uri.slice('vmess://'.length).trim()));
	if (!raw.add || !raw.port || !raw.id) throw new Error(_('VMess server, port and UUID are required'));
	var out = {
		enabled: '1', protocol: 'vmess', label: raw.ps || 'VMess ' + raw.add,
		server: raw.add, port: String(raw.port), uuid: raw.id, alter_id: String(raw.aid || 0),
		sni: raw.sni || '', host: raw.host || '', path: raw.path || '',
		security: raw.tls === 'tls' ? 'tls' : ''
	};
	if (raw.net === 'ws') out.transport = 'ws';
	return out;
}

function parse(uri) {
	var value = (uri || '').trim(), scheme = value.split(':', 1)[0].toLowerCase();
	if (scheme === 'vmess') return parseVmess(value);
	if (scheme === 'hy2') scheme = 'hysteria2';
	if (scheme === 'wg') scheme = 'wireguard';
	if (['anytls', 'hysteria2', 'tuic', 'vless', 'trojan', 'wireguard'].indexOf(scheme) < 0)
		throw new Error(_('Unsupported node link format'));
	return parseUrl(value, scheme);
}

return baseclass.extend({ parse: parse });
