/*
 * Copyright (C) 2026 Jove Yu <yushijun110@gmail.com>
 *
 * This is free software, licensed under the GNU General Public License v3.
 * See /LICENSE for more information.
 */

'use strict';
'require view';
'require form';
'require uci';

var conf = 'shadowsocks-rust';

return view.extend({
	load: function() {
		return uci.load(conf);
	},

	render: function() {
		var encryptionMethods = [
			'none',
			'plain',
			'aes-128-gcm',
			'aes-192-gcm',
			'aes-256-gcm',
			'chacha20-ietf-poly1305',
			'xchacha20-ietf-poly1305',
			'2022-blake3-aes-128-gcm',
			'2022-blake3-aes-256-gcm',
			'2022-blake3-chacha20-poly1305'
		];

		var m, s, o;

		m = new form.Map(conf, _('Servers'),
			_('Definition of remote shadowsocks servers.  \
				Disable any of them will also disable instances referring to it.'));

		s = m.section(form.GridSection, 'server');
		s.addremove = true;

		o = s.option(form.Flag, 'disabled', _('Disable'));
		o.editable = true;

		o = s.option(form.Value, 'server', _('Server Address'));
		o.datatype = 'host';

		o = s.option(form.Value, 'server_port', _('Server Port'));
		o.datatype = 'port';

		o = s.option(form.ListValue, 'method', _('Encryption Method'));
		o.datatype = 'string';
		o.default = 'chacha20-ietf-poly1305';
		encryptionMethods.forEach(function(method) {
			o.value(method, method);
		});

		o = s.option(form.Value, 'password', _('Password'));
		o.password = true;
		o.datatype = 'string';
		o.modalonly = true;

		o = s.option(form.Value, 'plugin', _('Plugin'));
		o.datatype = 'string';
		o.modalonly = true;

		o = s.option(form.Value, 'plugin_opts', _('Plugin Options'));
		o.datatype = 'string';
		o.modalonly = true;

		o = s.option(form.Value, 'timeout', _('Timeout'));
		o.datatype = 'uinteger';
		o.placeholder = '60';
		o.default = '60';
		o.modalonly = true;

		return m.render();
	}
});
