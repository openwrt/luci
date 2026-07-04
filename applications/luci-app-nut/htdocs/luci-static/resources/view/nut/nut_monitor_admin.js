'use strict';
'require form';
'require fs';
'require view';

const ups_ssl_backend_file = '/usr/share/nut/ssl_backend';

function MonitorUserOptions(s) {
	let o

	s.optional = true;
	s.addremove = true;
	s.anonymous = true;

	o = s.option(form.Value, 'upsname', _('Name of UPS'), _('As configured by NUT'));
	o.optional = false;

	o = s.option(form.Value, 'hostname', _('Hostname or address of UPS'));
	o.optional = false;
	o.datatype = 'or(host,ipaddr)';

	o = s.option(form.Value, 'port', _('Port'));
	o.optional = true;
	o.placeholder = 3493;
	o.datatype = 'port';

	o = s.option(form.Value, 'powervalue', _('Power value'));
	o.optional = false;
	o.datatype = 'uinteger';
	o.default = 1;

	o = s.option(form.Value, 'username', _('Username'));
	o.optional = false;

	o = s.option(form.Value, 'password', _('Password'));
	o.optional = false;
	o.password = true;

	return s;
}

function ESIFlags(o) {
	o.value('EXEC', _('Execute notify command'));
	o.value('SYSLOG', _('Write to syslog'));
	o.value('SYSLOG+EXEC', _('Write to syslog and execute notify command'))
	o.value('IGNORE', _('Ignore'));
	o.default = 'SYSLOG';
	o.optional = true;
	return o;
}

return view.extend({
	load: function() {
		return Promise.all([
			fs.trimmed(ups_ssl_backend_file)
		])
	},

	render: function(loaded_promises) {
		let m, s, o;

		const ssl_support_type = loaded_promises[0];

		m = new form.Map('nut_monitor_root', _('NUT Monitor'),
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

			o = s.option(form.Flag, 'certverify', _('Verify all connections with SSL'), _('Require SSL and verify host certificate'));
			o.optional = true;
			o.default = false;
			o.rmempty = false

			o = s.option(form.Flag, 'forcessl', _('Require SSL to connect'), _('Require SSL even if not verifying host certificates'));
			o.optional = true;
			o.default = false;
			o.rmempty = false;

			o = s.option(form.DynamicList, 'certhost', _('Per-host override for certident, certverify, and forcessl'), _('hostname "certificate name" certverify (as 0 or 1) forcessl (as 0 or 1)'));
			o.optional = true;
			o.placeholder = 'hostname "certificate name" certverify forcessl';
		}

		s = m.section(form.TypedSection, 'monitor', _('UPS Monitor User Settings'));
		MonitorUserOptions(s);

		o = s.option(form.ListValue, 'type', _('User type (Primary/Auxiliary)'));
		o.optional = false;
		o.value('primary', 'Primary');
		o.value('secondary', 'Auxiliary');
		o.default = 'secondary'

		s = m.section(form.TypedSection, 'notifications', _('Notifications settings'));
		s.optional = true;
		s.addremove = true;
		s.anonymous = false;

		o = s.option(form.Value, 'message', _('Custom notification message for message type'));
		o.optional = true

		o = s.option(form.ListValue, 'flag', _('Notification flags'));
		ESIFlags(o)

		s = m.section(form.TypedSection, 'master', _('UPS Primary (Deprecated)'));
		MonitorUserOptions(s);

		s = m.section(form.TypedSection, 'slave', _('UPS Auxiliary (Deprecated)'));
		MonitorUserOptions(s);

		return m.render();
	}
});
