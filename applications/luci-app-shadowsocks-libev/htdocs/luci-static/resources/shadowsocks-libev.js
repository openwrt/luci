'use strict';
'require baseclass';
'require uci';
'require form';
'require network';

var names_options_server = [
	'server',
	'server_port',
	'method',
	'key',
	'password',
	'plugin',
	'plugin_opts',
];

var names_options_client = [
	'server',
	'local_address',
	'local_port',
];

var names_options_common = [
	'local_address',
	'verbose',
	'ipv6_first',
	'fast_open',
	'no_delay',
	'reuse_port',
	'mode',
	'mtu',
	'timeout',
	'user',
];

var modes = [
	'tcp_only',
	'tcp_and_udp',
	'udp_only',
];

var methods = [
	// aead
	'aes-128-gcm',
	'aes-192-gcm',
	'aes-256-gcm',
	'chacha20-ietf-poly1305',
	'xchacha20-ietf-poly1305',
	// stream
	'table',
	'rc4',
	'rc4-md5',
	'aes-128-cfb',
	'aes-192-cfb',
	'aes-256-cfb',
	'aes-128-ctr',
	'aes-192-ctr',
	'aes-256-ctr',
	'bf-cfb',
	'camellia-128-cfb',
	'camellia-192-cfb',
	'camellia-256-cfb',
	'salsa20',
	'chacha20',
	'chacha20-ietf',
];

function ucival_to_bool(val) {
	return val === 'true' || val === '1' || val === 'yes' || val === 'on';
}

return baseclass.extend({
	values_actions: function(o) {
		o.value('bypass');
		o.value('forward');
		if (o.option !== 'dst_default') {
			o.value('checkdst');
		}
	},
	values_redir: function(o, xmode) {
		uci.sections('shadowsocks-libev', 'ss_redir', function(sdata) {
			var disabled = ucival_to_bool(sdata['disabled']),
				sname = sdata['.name'],
				mode = sdata['mode'] || 'tcp_only';
			if (!disabled && mode.indexOf(xmode) !== -1) {
				o.value(sname, sname + ' - ' + mode);
			}
		});
		o.value('', '<unset>');
		o.default = '';
	},
	values_serverlist: function(o) {
		uci.sections('shadowsocks-libev', 'server', function(sdata) {
			var sname = sdata['.name'],
				server = sdata['server'],
				server_port = sdata['server_port'];
			if (server && server_port) {
				var disabled = ucival_to_bool(sdata['.disabled']) ? ' - disabled' : '',
					desc = '%s - %s:%s%s'.format(sname, server, server_port, disabled);
				o.value(sname, desc);
			}
		});
	},
	values_ip4addr: function(o, netDevs) {
		netDevs.forEach(function(v) {
			v.getIPAddrs().forEach(function(a) {
				var host = a.split('/')[0];
				o.value(host, '%s (%s)'.format(host, v.getShortName()));
			});
		});
	},
	values_ip6addr: function(o, netDevs) {
		netDevs.forEach(function(v) {
			v.getIP6Addrs().forEach(function(a) {
				var host = a.split('/')[0];
				o.value(host, '%s (%s)'.format(host, v.getShortName()));
			});
		});
	},
	values_ipaddr: function(o, netDevs) {
		this.values_ip4addr(o, netDevs)
		this.values_ip6addr(o, netDevs)
	},
	options_client: function(s, tab, netDevs) {
		var o = s.taboption(tab, form.ListValue, 'server', _('Remote server'));
		this.values_serverlist(o);
		o = s.taboption(tab, form.Value, 'local_address', _('Local address'));
		o.datatype = 'ipaddr';
		o.placeholder = '0.0.0.0';
		this.values_ipaddr(o, netDevs);
		o = s.taboption(tab, form.Value, 'local_port', _('Local port'));
		o.datatype = 'port';
	},
	options_server: function(s, opts) {
		var o, optfunc,
			tab = opts && opts.tab || null;

		if (!tab) {
			optfunc = function(/* ... */) {
				var o = s.option.apply(s, arguments);
				o.editable = true;
				return o;
			};
		} else {
			optfunc = function(/* ... */) {
				var o = s.taboption.apply(s, L.varargs(arguments, 0, tab));
				o.editable = true;
				return o;
			};
		}

		o = optfunc(form.Value, 'server', _('Server'));
		o.datatype = 'host';
		o.size = 16;

		o = optfunc(form.Value, 'server_port', _('Server port'));
		o.datatype = 'port';
		o.size = 5;

		o = optfunc(form.ListValue, 'method', _('Method'));
		methods.forEach(function(m) {
			o.value(m);
		});

		o = optfunc(form.Value, 'password', _('Password'));
		o.password = true;
		o.size = 12;

		o = optfunc(form.Value, 'key', _('Key (base64)'));
		o.datatype = 'base64';
		o.password = true;
		o.size = 12;
		o.modalonly = true;;

		optfunc(form.Value, 'plugin', _('Plugin')).modalonly = true;

		optfunc(form.Value, 'plugin_opts', _('Plugin Options')).modalonly = true;
	},
	options_common: function(s, tab) {
		var o = s.taboption(tab, form.ListValue, 'mode', _('Mode of operation'));
		modes.forEach(function(m) {
			o.value(m);
		});
		o.default = 'tcp_and_udp';
		o = s.taboption(tab, form.Value, 'mtu', _('MTU'));
		o.datatype = 'uinteger';
		o = s.taboption(tab, form.Value, 'timeout', _('Timeout (sec)'));
		o.datatype = 'uinteger';
		s.taboption(tab, form.Value, 'user', _('Run as'));

		s.taboption(tab, form.Flag, 'verbose', _('Verbose'));
		s.taboption(tab, form.Flag, 'ipv6_first', _('IPv6 First'), _('Prefer IPv6 addresses when resolving names'));
		s.taboption(tab, form.Flag, 'fast_open', _('Enable TCP Fast Open'));
		s.taboption(tab, form.Flag, 'no_delay', _('Enable TCP_NODELAY'));
		s.taboption(tab, form.Flag, 'reuse_port', _('Enable SO_REUSEPORT'));
	},
	ucival_to_bool: function(val) {
		return ucival_to_bool(val);
	},
	cfgvalue_overview: function(sdata) {
		var stype = sdata['.type'],
			lines = [];

		if (stype === 'ss_server') {
			this.cfgvalue_overview_(sdata, lines, names_options_server);
			this.cfgvalue_overview_(sdata, lines, names_options_common);
			this.cfgvalue_overview_(sdata, lines, ['local_ipv4_address', 'local_ipv6_address']);
		} else if (stype === 'ss_local' || stype === 'ss_redir' || stype === 'ss_tunnel') {
			this.cfgvalue_overview_(sdata, lines, names_options_client);
			if (stype === 'ss_tunnel') {
				this.cfgvalue_overview_(sdata, lines, ['tunnel_address']);
			}
			this.cfgvalue_overview_(sdata, lines, names_options_common);
		} else {
			return [];
		}

		return lines;
	},
	cfgvalue_overview_: function(sdata, lines, names) {
		names.forEach(function(n) {
			var v = sdata[n];
			if (v) {
				if (n === 'key' || n === 'password') {
					v = _('<hidden>');
				}
				var fv = E('var', [v]);
				if (sdata['.type'] !== 'ss_server' && n === 'server') {
					fv = E('a', {
						class: 'label',
						href: L.url('admin/services/shadowsocks-libev/servers') + '#edit=' + v,
						target: '_blank',
						rel: 'noopener'
					}, fv);
				}
				lines.push(n + ': ', fv, E('br'));
			}
		});
	},
	option_install_package: function(s, tab) {
		var bin = s.sectiontype.replace('_', '-'),
			opkg_package = 'shadowsocks-libev-' + bin, o;
		if (tab) {
			o = s.taboption(tab, form.Button, '_install');
		} else {
			o = s.option(form.Button, '_install');
		}
		o.title      = _('Package is not installed');
		o.inputtitle = _('Install package ' + opkg_package);
		o.inputstyle = 'apply';
		o.onclick = function() {
			window.open(L.url('admin/system/opkg') +
				'?query=' + opkg_package, '_blank', 'noopener');
		};
	},
	parse_uri: function(uri) {
		var scheme = 'ss://';
		if (uri && uri.indexOf(scheme) === 0) {
			var atPos = uri.indexOf('@'), hashPos = uri.lastIndexOf('#'), tag;
			if (hashPos === -1) {
				hashPos = undefined;
			} else {
				tag = uri.slice(hashPos + 1);
			}

			if (atPos !== -1) { // SIP002 format https://shadowsocks.org/en/spec/SIP002-URI-Scheme.html
				var colonPos = uri.indexOf(':', atPos + 1), slashPos = uri.indexOf('/', colonPos + 1);
				if (colonPos === -1) return null;
				if (slashPos === -1) slashPos = undefined;

				var userinfo = atob(uri.slice(scheme.length, atPos)
					.replace(/-/g, '+').replace(/_/g, '/')),
					i = userinfo.indexOf(':');
				if (i === -1) return null;

				var config = {
					server: uri.slice(atPos + 1, colonPos),
					server_port: uri.slice(colonPos + 1, slashPos ? slashPos : hashPos),
					password: userinfo.slice(i + 1),
					method: userinfo.slice(0, i)
				};

				if (slashPos) {
					var search = uri.slice(slashPos + 1, hashPos);
					if (search[0] === '?') search = search.slice(1);
					search.split('&').forEach(function(s) {
						var j = s.indexOf('=');
						if (j !== -1) {
							var k = s.slice(0, j), v = s.slice(j + 1);
							if (k === 'plugin') {
								v = decodeURIComponent(v);
								var k = v.indexOf(';');
								if (k !== -1) {
									config['plugin'] = v.slice(0, k);
									config['plugin_opts'] = v.slice(k + 1);
								}
							}
						}
					});
				}
				return [config, tag];
			} else { // Legacy format https://shadowsocks.org/en/config/quick-guide.html
				var plain = atob(uri.slice(scheme.length, hashPos)),
					firstColonPos = plain.indexOf(':'),
					lastColonPos = plain.lastIndexOf(':'),
					atPos = plain.lastIndexOf('@', lastColonPos);
				if (firstColonPos === -1 ||
					lastColonPos === -1 ||
					atPos === -1) return null;

				var config = {
					server: plain.slice(atPos + 1, lastColonPos),
					server_port: plain.slice(lastColonPos + 1),
					password: plain.slice(firstColonPos + 1, atPos),
					method: plain.slice(0, firstColonPos)
				};
				return [config, tag];
			}
		}
		return null;
	}
});
