'use strict';
'require form';
'require fs';
'require view';

const ups_ssl_backend_file = '/usr/share/nut/ssl_backend';
const ups_daemon = '/usr/sbin/upsd';

return view.extend({
	load: function() {
		return Promise.all([
			fs.trimmed(ups_ssl_backend_file).then(function(backend) {
				if (backend)
					return backend;
				// nut older than 2.8.5-5 does not ship ssl_backend, so probe the binary instead
				return L.resolveDefault(fs.exec_direct('/usr/bin/ldd', [ups_daemon]), '').then(function(stdout) {
					return stdout.includes('libssl.so') ? 'old_nut_openssl' : 'none';
				});
			}),
		])
	},

	render: function(loaded_promises) {
		let m, s, o;

		const ssl_support_type = loaded_promises[0];

		m = new form.Map('nut_server', _('NUT Server'),
			_('Network UPS Tools Server Configuration'));

		// Server global settings
		s = m.section(form.NamedSection, 'upsd', 'upsd', _('UPS Server Global Settings'));
		s.addremove = true;

		o = s.option(form.Value, 'runas', _('RunAs User'), _('Drop privileges to this user'));
		o.optional = true;
		o.placeholder = 'nut'

		o = s.option(form.Value, 'statepath', _('Path to state file'));
		o.optional = true;
		o.placeholder = '/var/run/nut'

		if (ssl_support_type == 'openssl' || ssl_support_type == 'old_nut_openssl') {
			o = s.option(form.FileUpload, 'certfile', _('Server certificate chain and private key'), _('PEM file containing server certificate chain and private key (OpenSSL)'));
			o.rmempty = true;
			o.optional = true;
		}

		if (ssl_support_type == 'openssl') {
			// For OpenSSL, certpath is a PEM file, not a database directory as with NSS
			o = s.option(form.FileUpload, 'certpath', _('CA certificate(s)'), _('PEM file containing the CA certificate(s) (OpenSSL)'));
			o.rmempty = true;
			o.optional = true;
		}

		if (ssl_support_type == 'nss') {
			// For NSS, certpath is a database directory, not a PEM file as with OpenSSL.
			// We do not fill this field by default as the default database has no certificates,
			// and must be filled to be useful. Doing this through the UI is a future task.
			o = s.option(form.Value, 'certpath', _('Path to NSS certificate and key databases'), _('An empty database was created in /etc/nut/cert_db at package install. To use it, SSH in, fill it using certutil, and put /etc/nut/cert_db in this field.'));
			o.optional = true;
		}

		if (ssl_support_type == 'openssl' || ssl_support_type == 'nss') {
			o = s.option(form.Value, 'certident', _('Certificate name and password'), _('"Certificate name" and "certificate password" need to be entered in double-quotes (") if the value has a space in it. An empty password must be entered as an empty pair of double-quotes ("")'));
			o.placeholder = '"certificate name" "certificate password"';
			o.password = true;

			o = s.option(form.ListValue, 'certrequest', _('Certificate request level'), _('Whether to request a client certificate and whether to validate a requested client certificate'));
			o.value('0', _('NO (do not request or verify a client certificate)'));
			o.value('1', _('REQUEST (any client certificate)'));
			o.value('2', _('REQUIRE (and verify)'));

			o = s.option(form.Flag, 'disable_weak_ssl', _('Disable weak SSL'), _('Require at least TLSv1.2 for SSL communications'));
			o.rmempty = false;
			o.optional = false;
			o.default = true;
		}

		return m.render();
	}
});
