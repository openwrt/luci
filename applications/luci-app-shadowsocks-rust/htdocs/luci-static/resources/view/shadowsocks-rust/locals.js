/*
 * Copyright (C) 2026 Jove Yu <yushijun110@gmail.com>
 *
 * This is free software, licensed under the GNU General Public License v3.
 * See /LICENSE for more information.
 */

'use strict';
'require view';
'require poll';
'require form';
'require uci';
'require fs';
'require network';
'require rpc';

var conf = 'shadowsocks-rust';

return view.extend({
	load: function() {
		return uci.load(conf);
	},
	render: function(stats) {
		var m, s, o;

		m = new form.Map(conf,
			_('Locals'),
			_('Configure local service instances for shadowsocks-rust. \
			   Instances define how the client services (SOCKS5, HTTP, DNS, Tunnel, TUN, etc.) \
			   connect through remote servers. To enable an instance it \
			   is required to enable both the instance itself and the remote \
			   server it refers to.'));

		s = m.section(form.GridSection, 'local');
		s.addremove = true;

		o = s.option(form.Flag, 'disabled', _('Disable'));
		o.editable = true;

		o = s.option(form.ListValue, 'server', _('Server'));
		o.datatype = 'string';
		uci.sections(conf, 'server').forEach(function(server) {
			var label = server['.name'] + ' (' + server.server + ':' + server.server_port + ')';
			o.value(server['.name'], label);
		});

		o = s.option(form.ListValue, 'protocol', _('Protocol'));
		o.datatype = 'string';
		o.value('socks', 'SOCKS5');
		o.value('http', 'HTTP');
		o.value('redir', 'REDIR');
		o.value('tunnel', 'TUNNEL');
		o.value('dns', 'DNS');
		o.value('tun', 'TUN');
		o.default = 'socks';

		o = s.option(form.Value, 'local_address', _('Listen Address'));
		o.datatype = 'ipaddr';
		o.placeholder = '::';
		o.default = '::';

		o = s.option(form.Value, 'local_port', _('Listen Port'));
		o.datatype = 'port';
		o.placeholder = '1080';

		o = s.option(form.ListValue, 'mode', _('Mode'));
		o.datatype = 'string';
		o.value('tcp_only', _('TCP Only'));
		o.value('udp_only', _('UDP Only'));
		o.value('tcp_and_udp', _('TCP and UDP'));
		o.default = 'tcp_only';
		o.modalonly = true;

		// Tunnel specific options
		o = s.option(form.Value, 'forward_address', _('Forward Address'));
		o.datatype = 'host';
		o.placeholder = '8.8.8.8';
		o.depends('protocol', 'tunnel');
		o.modalonly = true;

		o = s.option(form.Value, 'forward_port', _('Forward Port'));
		o.datatype = 'port';
		o.placeholder = '53';
		o.depends('protocol', 'tunnel');
		o.modalonly = true;

		// DNS specific options
		o = s.option(form.Value, 'local_dns_address', _('Local DNS Address'));
		o.datatype = 'host';
		o.placeholder = '114.114.114.114';
		o.depends('protocol', 'dns');
		o.modalonly = true;

		o = s.option(form.Value, 'local_dns_port', _('Local DNS Port'));
		o.datatype = 'port';
		o.placeholder = '53';
		o.default = '53';
		o.depends('protocol', 'dns');
		o.modalonly = true;

		o = s.option(form.Value, 'remote_dns_address', _('Remote DNS Address'));
		o.datatype = 'host';
		o.placeholder = '8.8.8.8';
		o.depends('protocol', 'dns');
		o.modalonly = true;

		o = s.option(form.Value, 'remote_dns_port', _('Remote DNS Port'));
		o.datatype = 'port';
		o.placeholder = '53';
		o.default = '53';
		o.depends('protocol', 'dns');
		o.modalonly = true;

		o = s.option(form.Value, 'client_cache_size', _('DNS Cache Size'));
		o.datatype = 'uinteger';
		o.placeholder = '10';
		o.default = '10';
		o.depends('protocol', 'dns');
		o.modalonly = true;

		// TUN specific options
		o = s.option(form.Value, 'tun_interface_name', _('TUN Interface Name'));
		o.datatype = 'string';
		o.placeholder = 'tun0';
		o.default = 'tun0';
		o.depends('protocol', 'tun');
		o.modalonly = true;

		o = s.option(form.Value, 'tun_interface_address', _('TUN Interface Address'));
		o.datatype = 'cidr';
		o.placeholder = '10.255.0.1/24';
		o.depends('protocol', 'tun');
		o.modalonly = true;

		return m.render();
	}
});