'use strict';
'require form';
'require view';

// OptionalFlag helper function
function OptionalFlag(section, key, title, description) {
	let o = section.option(form.ListValue, key, title, description);
	o.value('', _('Default'));
	o.value('1', _('Enabled'));
	o.value('0', _('Disabled'));
	return o;
}

var mosquitto_conf = '/etc/mosquitto/mosquitto.conf'

return view.extend({
	load: function() {

	},

	render: function() {
		let m, s, o;

		// Define the Map
		m = new form.Map('mosquitto', _('Mosquitto MQTT Broker'), _(
			'mosquitto - the ' +
			"<a href='http://www.mosquitto.org'>blood thirsty</a>" +
			' MQTT messaging broker. Note, only some of the available configuration files ' +
			'are supported at this stage. Use the checkbox below to use config generated ' +
			'by this page, or the stock mosquitto configuration file in %s.'
			.format('<code>' + mosquitto_conf + '</code>')));

		// Section: OpenWRT
		s = m.section(form.TypedSection, 'owrt', 'OpenWRT');
		s.anonymous = true;

		o = s.option(form.Flag, 'use_uci', _('Use this LuCI configuration page'), _(
			'If checked, mosquitto runs with a config generated from this page. ' +
			'If unchecked, mosquitto runs with the config in %s (and this page is ignored).'
			.format('<code>' + mosquitto_conf + '</code>')));

		// Section: Mosquitto
		s = m.section(form.TypedSection, 'mosquitto', _('Mosquitto'));
		s.anonymous = true;

		o = s.option(form.MultiValue, 'log_dest', _('Log destination'), _("You can have multiple, but 'none' will override all others"));
		o.value('stderr', 'stderr');
		o.value('stdout', 'stdout');
		o.value('syslog', 'syslog');
		o.value('topic', '$SYS/broker/log/[severity]');
		o.value('none', 'none');

		o = OptionalFlag(s, 'no_remote_access', _('Disallow remote access to this broker'), _(
			'Outbound bridges will still work, but this will make the primary listener ' +
			'only available from localhost'));

		o = s.option(form.Value, 'sys_interval', _('Time in seconds between updates of the $SYS tree'), _('Set to zero to disable'));
		o.datatype = 'uinteger';

		o = OptionalFlag(s, 'allow_anonymous', _('Allow anonymous connections'), _('Allow to connect without providing a username and password'));

		o = s.option(form.Value, 'max_inflight_messages', _('Max Inflight Messages'), _('Limit for message allowed inflight'));
		o.datatype = 'uinteger';

		o = s.option(form.Value, 'max_queued_messages', _('Max Queued Messages'), _('Limit for message queue when offline'));
		o.datatype = 'uinteger';

		o = s.option(form.Value, 'max_queued_bytes', _('Max Queued Bytes'), _('Limit for message queue when offline, zero to disable'));
		o.datatype = 'uinteger';

		// Section: Persistence
		s = m.section(form.TypedSection, 'persistence', _('Persistence'));
		s.anonymous = true;

		o = s.option(form.Flag, 'persistence', _('Persistence enabled'), _('Should persistence to disk be enabled at all'));

		o = s.option(form.Value, 'client_expiration', _('Client expiration'), _("Remove persistent clients if they haven't reconnected in this period, eg 6h, 3d, 2w"));
		o.depends('persistence', '1');

		o = OptionalFlag(s, 'autosave_on_changes', _('Autosave on changes'), _('Autosave interval applies to change counts instead of time'));
		o.depends('persistence', '1');

		o = s.option(form.Value, 'autosave_interval', _('Autosave interval'), _('Save persistence file after this many seconds or changes'));
		o.depends('persistence', '1');

		o = s.option(form.Value, 'file', _('Persistent file name'));
		o.depends('persistence', '1');

		o = s.option(form.Value, 'location', _('Persistent file path (with trailing/)'), _('Path to persistent file'));
		o.depends('persistence', '1');

		// Section: Listeners
		s = m.section(form.TypedSection, 'listener', _('Listeners'), _('You can configure additional listeners here'));
		s.anonymous = true;
		s.addremove = true;

		o = s.option(form.Value, 'port', _('Port'));
		o.datatype = 'port';

		o = s.option(form.ListValue, 'protocol', _('Protocol to use when listening'));
		o.value('', _('Default'));
		o.value('mqtt', _('MQTT'));
		o.value('websockets', _('WebSockets'));

		o = s.option(form.Value, 'http_dir', _('http_dir to serve on websockets listeners'));

		o = OptionalFlag(s, 'use_username_as_clientid', 'use_username_as_clientid');

		o = s.option(form.Value, 'cafile', _('CA file path'));
		o.datatype = 'file';

		o = s.option(form.Value, 'capath', _('CA path to search'));
		o.datatype = 'directory';

		o = s.option(form.Value, 'certfile', _('Server certificate file (PEM encoded)'));
		o.datatype = 'file';

		o = s.option(form.Value, 'keyfile', _('Keyfile (PEM encoded)'));
		o.datatype = 'file';

		o = s.option(form.ListValue, 'tls_version', _('TLS Version'),
			_('Depends on your openssl version, empty to support all'));
		o.optional = true;
		o.value('', 'Default');
		o.value('tlsv1.1');
		o.value('tlsv1.2');
		o.value('tlsv1.3');

		o = OptionalFlag(s, 'require_certificate', _('Require clients to present a certificate'));
		o = OptionalFlag(s, 'use_identity_as_username', 'use_identity_as_username');
		o = s.option(form.Value, 'crlfile', _('CRL to use if require_certificate is enabled'));
		o.optional = true;
		o = s.option(form.Value, 'ciphers', _("Ciphers control. Should match 'openssl ciphers' format"));
		o.optional = true;

		o = s.option(form.Value, 'psk_hint', _('PSK Hint to provide to connecting clients'));
		o.optional = true;

		s = m.section(form.TypedSection, 'bridge', _('Bridges'),
			_('You can configure multiple bridge connections here'));
		s.anonymous = true;
		s.addremove = true;

		o = s.option(form.Value, 'connection', _('Connection name'),
			_('unique name for this bridge configuration'));

		o = s.option(form.Value, 'address', _('address'), _('address[:port] of remote broker'));
		o.datatype = 'or(hostport,host,ipaddrport)';

		o = s.option(form.DynamicList, 'topic', _('topic'),
			_("full topic string for mosquitto.conf, eg: 'power/# out 2'"));
		o.placeholder = 'power/# out 2';

		o = OptionalFlag(s, 'cleansession', _('Clean session'));

		o = OptionalFlag(s, 'notifications', _('notifications'),
			_('Attempt to notify the local and remote broker of connection status, defaults to $SYS/broker/connections/&lt;clientid&gt;/state'));

		s.option(form.Value, 'notification_topic', _('Topic to use for local+remote remote for notifications.'));
		o.optional = true;
		
		o = OptionalFlag(s, 'notifications_local_only', _('Notifications local only'), _('Bridge connection states should only be published locally'));

		o = s.option(form.Value, 'remote_clientid', _('Client id to use on remote end of this bridge connection'));
		o.optional = true;
		
		o = s.option(form.Value, 'local_clientid', _('Client id to use locally. Important when bridging to yourself'));
		o.optional = true;
		
		o = s.option(form.Value, 'keepalive_interval', _('Keep-alive interval for this bridge'));
		o.datatype = 'uinteger';
		o.optional = true;
		
		o = s.option(form.ListValue, 'start_type', _('How should this bridge be started'));
		o.optional = true;
		o.value('', 'Default');
		o.value('automatic', _('Automatic, includes restarts'));
		o.value('lazy', _('Automatic, but stopped when not used'));
		o.value('once', _('Automatic, but no restarts'));

		o = s.option(form.Value, 'restart_timeout', _('How long to wait before reconnecting'));
		o.datatype = 'uinteger';
		o.optional = true;

		o = s.option(form.Value, 'idle_timeout', _('How long to wait before disconnecting'));
		o.datatype = 'uinteger';
		o.optional = true;

		o = s.option(form.Value, 'threshold', _('How many messages to queue before restarting lazy bridge'));
		o.datatype = 'uinteger';
		o.optional = true;

		o = OptionalFlag(s, 'try_private', 'try_private',
			_('attempt to notify the remote broker that this is a bridge, not all brokers support this.'));

		o = s.option(form.Value, 'remote_username', _('Remote username'));
		o.optional = true;

		o = s.option(form.Value, 'remote_password', _('Remote password'));
		o.optional = true;
		o.password = true;

		o = s.option(form.Value, 'identity', _('PSK Bridge Identity'), _('Identity for TLS-PSK'));
		o.optional = true;

		o = s.option(form.Value, 'psk', _('Bridge PSK'), _('Key for TLS-PSK'));
		o.password = true;
		o.optional = true;
		o.datatype = 'hexstring';

		o = s.option(form.ListValue, 'tls_version', _('TLS Version'),
		    _('The remote broker must support the same version of TLS for the connection to succeed.'));
		o.value('', 'Default');
		o.value('tlsv1.1');
		o.value('tlsv1.2');
		o.value('tlsv1.3');
		o.optional = true;

		o = s.option(form.Value, 'cafile', _('Path to CA file'));
		o.optional = true;
		o.datatype = 'file'

		o = s.option(form.Value, 'capath', _('Directory to search for CA files'));
		o.optional = true;
		o.datatype = 'directory'

		o = s.option(form.Value, 'certfile', _('Path to PEM encoded server certificate file'));
		o.optional = true;
		o.datatype = 'file'

		o = s.option(form.Value, 'keyfile', _('Path to PEM encoded keyfile'));
		o.optional = true;
		o.datatype = 'file'

		return m.render();
	}
});
