'use strict';
'require form';
'require fs';
'require view';

const ups_ssl_backend_file = '/usr/share/nut/ssl_backend';
const upsmon_daemon = '/usr/sbin/upsmon';

return view.extend({
	load: function() {
		return Promise.all([
			fs.trimmed(ups_ssl_backend_file).then(function(backend) {
				if (backend)
					return backend;
				// nut older than 2.8.5-5 does not ship ssl_backend, so probe the binary instead
				return L.resolveDefault(fs.exec_direct('/usr/bin/ldd', [upsmon_daemon]), '').then(function(stdout) {
					return stdout.includes('libssl.so') ? 'old_nut_openssl' : 'none';
				});
			}),
		])
	},

	render: function(loaded_promises) {
		let m, s, o;

		const ssl_support_type = loaded_promises[0];

		m = new form.Map('nut_monitor', _('NUT Monitor'),
			_('Network UPS Tools Monitoring Configuration'));

		s = m.section(form.NamedSection, 'upsmon', 'upsmon', _('Global Settings'));
		s.addremove = true;
		s.optional = true;

		o = s.option(form.Value, 'runas', _('RunAs User'), _('upsmon drops privileges to this user'));
		o.placeholder = 'nutmon'

		o = s.option(form.Value, 'notifycmd', _('Notify command'));
		o.optional = true;

		o = s.option(form.Value, 'shutdowncmd', _('Shutdown command'));
		o.optional = true;
		o.placeholder = '/usr/sbin/nutshutdown'

		if (ssl_support_type == 'openssl') {
			o = s.option(form.FileUpload, 'certfile', _('Client certificate chain and private key'), _('PEM file containing client certificate chain and private key (OpenSSL)'));
			o.rmempty = true;
			o.optional = true;
		}

		if (ssl_support_type == 'openssl' || ssl_support_type == 'old_nut_openssl') {
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
		}

		if (ssl_support_type == 'openssl' || ssl_support_type == 'old_nut_openssl' || ssl_support_type == 'nss') {
			o = s.option(form.Flag, 'certverify', _('Verify all connections with SSL'), _('Require SSL and verify host certificate'));
			o.optional = true;
			o.default = false;
			o.rmempty = false

			o = s.option(form.Flag, 'forcessl', _('Require SSL to connect'), _('Require SSL even if not verifying host certificates'));
			o.optional = true;
			o.default = false;
			o.rmempty = false;
		}

		if (ssl_support_type == 'openssl' || ssl_support_type == 'nss') {
			o = s.option(form.DynamicList, 'certhost', _('Per-host override for certident, certverify, and forcessl'), _('hostname "certificate name" certverify (as 0 or 1) forcessl (as 0 or 1)'));
			o.optional = true;
			o.placeholder = 'hostname "certificate name" certverify forcessl';
		}

		return m.render();
	}
});
