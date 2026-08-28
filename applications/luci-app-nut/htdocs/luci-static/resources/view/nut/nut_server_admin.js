'use strict';
'require form';
'require fs';
'require view';

const ups_ssl_backend_file = '/usr/share/nut/ssl_backend';

return view.extend({
	load: function() {
		return Promise.all([
			fs.trimmed(ups_ssl_backend_file)
		])
	},

	render: function(loaded_promises) {
		let m, s, o;

		const ssl_support_type = loaded_promises[0];

		m = new form.Map('nut_server_root', _('NUT Server'),
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

		if (ssl_support_type == 'openssl') {
			o = s.option(form.FileUpload, 'certfile', _('Server certificate chain and private key'), _('PEM file containing server certificate chain and private key (OpenSSL)'));
			o.rmempty = true;
			o.optional = true;

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

		// User settings
		s = m.section(form.TypedSection, 'user', _('NUT Users'));
		s.addremove = true;
		s.anonymous = true;

		o = s.option(form.Value, 'username', _('Username'));
		o.optional = false;

		o = s.option(form.Value, 'password', _('Password'));
		o.password = true;
		o.optional = false;

		o = s.option(form.MultiValue, 'actions', _('Allowed actions'));
		// o.widget = 'select'
		o.value('set', _('Set variables'));
		o.value('fsd', _('Forced Shutdown'));
		o.optional = true;

		o = s.option(form.DynamicList, 'instcmd', _('Instant commands'), _('Use %s to see full list of commands your UPS supports (requires %s package)'.format('<code>upscmd -l</code>', '<code>upscmd</code>')));
		o.optional = true;

		o = s.option(form.ListValue, 'upsmon', _('Role'));
		o.value('secondary', _('Auxiliary'));
		o.value('primary', _('Primary'));
		o.value('slave', _('Auxiliary (Deprecated)'));
		o.value('master', _('Primary (Deprecated)'));
		o.optional = false;

		return m.render();
	}
});
