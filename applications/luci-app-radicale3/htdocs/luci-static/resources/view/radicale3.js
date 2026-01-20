'use strict';
'require dom';
'require form';
'require view';
'require rpc';
'require uci';
'require ui';

// cspell:words Radicale addremove authtype cfgsections cfgvalue formvalue
// cspell:words hostport htpasswd ipaddrport noopener noreferrer nsections
// cspell:words origcfgsections plainpass ppconfirm rmempty sslon taboption
// cspell:words uinteger multifilesystem hidetitle packagelist libpass
// cspell:words passlib cffi

const callServiceList = rpc.declare({
	object: 'service',
	method: 'list',
	params: ['name'],
	expect: {
		radicale3: {},
	},
});

const callEncrypt = rpc.declare({
	object: 'rad3-enc',
	method: 'encrypt',
	params: ['type', 'plainpass'],
	expect: {},
});

const callPackageList = rpc.declare({
	object: 'rpc-sys',
	method: 'packagelist',
	params: ['all'],
	expect: {},
});

return view.extend({
	load() {
		return Promise.all([
			L.resolveDefault(callServiceList('radicale3')),
			L.resolveDefault(callPackageList(true)),
			uci.load('radicale3'),
		]);
	},
	render([service_list_r3, package_list_r3]) {
		let radicale_address, radicale_host, radicale_port, running, button;
		let has_ssl, package_list, python_ssl_version;

		radicale_host = uci.get('radicale3', 'server', 'host') || ['127.0.0.1:5232'];
		radicale_host = String(radicale_host?.[0]);
		radicale_address = radicale_host.substring(0, radicale_host.lastIndexOf(':')) || '127.0.0.1';

		button = '';

		if ((radicale_address == '127.0.0.1') || (radicale_address == '[::1]') || radicale_host == 'localhost') {
			ui.addNotification(_('Need a listen address'),
				_('Radicale needs a non-loopback IP address for your browser to access the web interface'));
		} else {
			if (radicale_address == '0.0.0.0' || radicale_address == '[::]') {
				radicale_address = window.location.hostname;
			}
			radicale_port = radicale_host.substring(radicale_host.lastIndexOf(':') + 1) || '5232';

			running = Object.keys(service_list_r3.instances || {}).length > 0;

			if (running)
				button = '&#160;&#160;<a class="btn" href="' + window.location.protocol + '//' + radicale_address + ':' + radicale_port + '" target="_blank" rel="noreferrer noopener">' + _('Open Web Interface') + '</a>';
		}

		package_list = package_list_r3.packages;
		python_ssl_version = package_list['python3-openssl'];
		has_ssl = (python_ssl_version != null) && (python_ssl_version != '');

		let m, s, o, at, hte, plainpass, ppconfirm, pass;

		m = new form.Map('radicale3', 'Radicale3', _('Radicale v3 CalDav/CardDAV Server Configuration') + button);

		s = m.section(form.NamedSection, 'server', 'section', _('Server Settings'));
		s.addremove = true;
		s.anonymous = false;

		s.tab('main', _('Main'));

		o = s.taboption('main', form.DynamicList, 'host', _('Host:port'));
		o.optional = true;
		o.datatype = 'or(hostport(0),ipaddrport(1))';
		o.default = ['127.0.0.1:5232', '[::1]:5232'];

		s.tab('advanced', _('Advanced'));

		if (has_ssl) {
			let sslon, cert_file, key_file, ca_file;

			sslon = s.taboption('main', form.Flag, 'ssl', _('SSL'), _('Enable SSL connections'));
			sslon.rmempty = true;
			sslon.default = sslon.disabled;

			cert_file = s.taboption('main', form.FileUpload, 'certificate', _('Certificate'));
			cert_file.rmempty = true;
			cert_file.optional = false;
			cert_file.depends('ssl', sslon.enabled);

			key_file = s.taboption('main', form.FileUpload, 'key', _('Private Key'));
			key_file.rmempty = true;
			key_file.optional = false;
			key_file.depends('ssl', sslon.enabled);

			sslon.cfgvalue = function (section_id) {
				return ((cert_file.cfgvalue(section_id) != null) && (key_file.cfgvalue(section_id) != null));
			};

			ca_file = s.taboption('advanced', form.FileUpload, 'certificate_authority', _('Client Certificate Authority'), _('For verifying client certificates'));
			ca_file.rmempty = true;
			ca_file.depends('ssl', sslon.enabled);

			o = s.taboption('advanced', form.Value, 'ciphers', _('Allowed Ciphers'), _('See python3-openssl documentation for available ciphers'));
			o.rmempty = true;
			o.depends('ssl', sslon.enabled);

			o = s.taboption('advanced', form.Value, 'protocol', _('Use Protocol'), _('See python3-openssl documentation for available protocols'));
			o.rmempty = true;
			o.depends('ssl', sslon.enabled);
			o.placeholder = 'PROTOCOL_TLSv1_2';
		} else {
			o = s.taboption('main', form.DummyValue, '_no_ssl', _('No SSL'), _('No SSL support available. Please install python3-openssl.'));
			o.write = function () {};
			o.cfgvalue = function () {
				return '';
			};
		}

		o = s.taboption('advanced', form.Value, 'max_connection', _('Max Connections'), _('Maximum number of simultaneous connections'));
		o.rmempty = true;
		o.placeholder = 20;
		o.datatype = 'uinteger';

		o = s.taboption('advanced', form.Value, 'max_content_length', _('Max Content Length'), _('Maximum size of request body (bytes)'));
		o.rmempty = true;
		o.datatype = 'uinteger';
		o.placeholder = 100000000;

		o = s.taboption('advanced', form.Value, 'timeout', _('Timeout'), _('Socket timeout (seconds)'));
		o.rmempty = true;
		o.placeholder = 30;
		o.datatype = 'uinteger';

		s = m.section(form.NamedSection, 'auth', 'section', _('Authentication'));
		s.addremove = true;

		let python_bcrypt_version, has_bcrypt, python_argon2_version, has_argon2;
		let python_libpass_version, has_libpass;

		python_libpass_version = package_list['python3-libpass'];
		has_libpass = (python_libpass_version != null) && (python_libpass_version != '');
		python_bcrypt_version = package_list['python3-bcrypt'];
		// Until we update radicale to the latest release that uses libpass instead
		// of passlib, bcrypt is only usable before version 5.0.0
		has_bcrypt = (python_bcrypt_version != null) && (python_bcrypt_version != ''
			&& !((!has_libpass) && (python_bcrypt_version.startsWith('5'))));
		python_argon2_version = package_list['python3-argon2-cffi'];
		has_argon2 = (python_argon2_version != null) && (python_argon2_version != '');

		s.tab('main', _('Main'));

		hte = s.taboption('main', form.ListValue, 'htpasswd_encryption', _('Encryption'), _('Password encryption method'));
		hte.depends({ type: 'htpasswd' });
		hte.depends({ type: '' });
		hte.value('plain', _('Plaintext'));
		hte.value('md5', _('MD5-APR1'));
		hte.value('sha256', _('SHA-256'));
		hte.value('sha512', _('SHA-512'));
		if (has_bcrypt) {
			hte.value('bcrypt', _('BCRYPT'));
		}
		if (has_argon2) {
			hte.value('argon2', _('ARGON2'));
		}
		hte.value('autodetect', _('autodetect'), _('password file can have users with a mix of support encryption methods'));
		hte.default = 'autodetect';
		hte.rmempty = true;

		s.tab('advanced', _('Advanced'));

		at = s.taboption('advanced', form.ListValue, 'type', _('Authentication Type'));
		at.value('', _('Default (htpasswd file from users below)'));
		at.value('htpasswd', _('htpasswd file (manually populated)'));
		at.value('none', _('No authentication'));
		at.value('remote_user', _('REMOTE_USER from web server'));
		at.value('http_x_remote_user', _('X-Remote-User from web server'));
		at.default = '';
		at.rmempty = true;

		o = s.taboption('advanced', form.Value, 'htpasswd_filename', _('Filename'), _('htpasswd-formatted file filename'));
		o.depends('type', 'htpasswd');
		o.rmempty = true;
		o.placeholder = '/etc/radicale3/users';
		o.default = '';

		o = s.taboption('advanced', form.Value, 'realm', _('Realm'), _('HTTP(S) Basic Authentication Realm'));
		o.rmempty = true;
		o.placeholder = 'Radicale - Password Required';

		o = s.taboption('advanced', form.Value, 'delay', _('Retry Delay'), _('Required time between a failed authentication attempt and trying again'));
		o.rmempty = true;
		o.default = 1;
		o.datatype = 'uinteger';
		o.depends({ type: '' });
		o.depends({ type: 'htpasswd' });
		o.depends({ type: 'remote_user' });
		o.depends({ type: 'http_x_remote_user' });

		// User settings
		s = m.section(form.TypedSection, 'user', _('Radicale3 Users'));
		s.addremove = true;
		s.anonymous = true;

		at = s.option(form.ListValue, '_auth_type', _('Encryption method when changing this password'));
		at.value('plain', _('Plaintext'));
		at.value('md5', _('MD5-APR1'));
		at.value('sha256', _('SHA-256'));
		at.value('sha512', _('SHA-512'));
		if (has_bcrypt) {
			at.value('bcrypt', _('BCRYPT'));
		}
		if (has_argon2) {
			at.value('argon2', _('ARGON2'));
		}
		at.default = 'sha512';
		at.depends({ 'radicale3.auth.type': 'htpasswd', 'radicale3.auth.htpasswd_encryption': 'autodetect' });
		at.depends({ 'radicale3.auth.type': '', 'radicale3.auth.htpasswd_encryption': 'autodetect' });

		at.cfgvalue = function () {
			return hte.cfgvalue('auth');
		};

		at.write = function () {};

		o = s.option(form.Value, 'name', _('Username'));
		o.optional = false;
		o.depends({ 'radicale3.auth.type': 'htpasswd' });
		o.depends({ 'radicale3.auth.type': '' });

		o.validate = function (section_id, value) {
			if (!value) {
				return _('Username is required');
			}

			if (value.length < 1) {
				return _('Username must be at least 1 character long');
			}

			if (!/^[a-zA-Z0-9._-]+$/.test(value)) {
				return _('Username can only contain letters, numbers, dots, underscores and hyphens');
			}

			// Check for duplicate usernames
			const sections = this.section.cfgsections();
			for (const section of sections) {
				if (section !== section_id) {
					const existingName = this.cfgvalue(section);
					if (existingName === value) {
						return _('Username already exists');
					}
				}
			}

			return true;
		};

		plainpass = s.option(form.Value, 'plain_pass', _('Plaintext Password'));
		plainpass.placeholder = 'Example password';
		plainpass.password = true;
		plainpass.depends({ 'radicale3.auth.type': 'htpasswd' });
		plainpass.depends({ 'radicale3.auth.type': '' });

		ppconfirm = s.option(form.Value, 'plain_pass_confirm', _('Confirm Plaintext Password'));
		ppconfirm.placeholder = 'Example password';
		ppconfirm.password = true;
		ppconfirm.depends({ 'radicale3.auth.type': 'htpasswd' });
		ppconfirm.depends({ 'radicale3.auth.type': '' });

		plainpass.write = function () {};
		ppconfirm.write = function () {};

		plainpass.validate = function (section, value) {
			if (value != ppconfirm.formvalue(section)) {
				return _('\'Plaintext Password\' and \'Confirm Plaintext Password\' do not match');
			} else if ((plainpass.formvalue(section) == '') && (hte.formvalue('auth') != 'autodetect') && (hte.formvalue('auth') != hte.cfgvalue('auth'))) {
				return _('When changing encryption method, you must change all passwords');
			} else {
				return true;
			}
		};

		ppconfirm.validate = function (section, value) {
			if (value != plainpass.formvalue(section)) {
				return _('\'Plaintext Password\' and \'Confirm Plaintext Password\' do not match');
			} else if ((ppconfirm.formvalue(section) == '') && (hte.formvalue('auth') != 'autodetect') && (hte.formvalue('auth') != hte.cfgvalue('auth'))) {
				return _('When changing encryption method, you must change all passwords');
			} else {
				return true;
			}
		};

		pass = s.option(form.Value, 'password', _('Encrypted Password'), _('If \'Plaintext Password\' is filled and matches \'Confirm Plaintext Password\' then this field becomes of hash of that password, otherwise this field remains the existing hash (you can also put your own hash value for the type of hash listed above).'));
		pass.password = true;
		pass.rmempty = false;
		pass.depends({ 'radicale3.auth.type': 'htpasswd' });
		pass.depends({ 'radicale3.auth.type': '' });
		pass.optional = true;

		pass.parse = (section_id) => {
			let active, plainValue;

			active = pass.isActive(section_id);
			plainValue = '';

			if (active && (plainpass.formvalue(section_id) === ppconfirm.formvalue(section_id))) {
				plainValue = plainpass.formvalue(section_id);
			} else {
				active = false;
			}

			if (active) {
				if (plainValue != '') {
					let variant;

					const authtype = hte.formvalue('auth') || 'plain';
					variant = at.formvalue(section_id) || 'plain';

					if (authtype != 'autodetect') {
						variant = authtype;
					}

					return callEncrypt(variant, plainValue).then((encryption_result) => {
						if (!encryption_result.encrypted_password) {
							m.reset();
							return Promise.reject(new TypeError(`${_('Unable to encrypt plaintext password')} ${encryption_result.error}`));
						} else {
							return pass.write(section_id, encryption_result.encrypted_password);
						}
					});
				} else {
					if (!pass.formvalue(section_id) && (plainpass.formvalue(section_id) === ppconfirm.formvalue(section_id)) && !plainpass.formvalue(section_id)) {
						return Promise.reject(new TypeError(
							_('Password is required')));
					} else {
						return Promise.resolve(pass.write(section_id, pass.formvalue(section_id)));
					}
				}
			} else if (!this.retain) {
				return Promise.resolve(pass.remove(section_id));
			}

			return Promise.resolve();
		};

		pass.validate = function (section_id, value) {
			const active = pass.isActive(section_id);

			if (active && !value && (plainpass.formvalue(section_id) === ppconfirm.formvalue(section_id)) && !plainpass.formvalue(section_id)) {
				return _('Password is required');
			}
			return true;
		};

		s = m.section(form.NamedSection, 'storage', 'section', _('Storage'));
		s.addremove = true;

		s.tab('main', _('Main'));

		o = s.taboption('main', form.Value, 'filesystem_folder', _('Folder'), _('Folder in which to store collections'));
		o.rmempty = true;
		o.placeholder = '/var/radicale3/data';

		s.tab('advanced', _('Advanced'));

		o = s.taboption('advanced', form.ListValue, 'type', _('Storage Type'));
		o.value('', _('Default (Multiple files on filesystem)'));
		o.value('multifilesystem', _('Multiple files on filesystem'));
		o.value('multifilesystem_nolock', _('Multiple files on filesystem wit no file-based locking. Must only be used with a single process.'));
		o.default = '';
		o.rmempty = true;

		o = s.taboption('advanced', form.Value, 'max_sync_token_age', _('Max Sync Token Age'), _('Delete sync tokens that are older (seconds)'));
		o.rmempty = true;
		o.placeholder = 2592000;
		o.datatype = 'uinteger';

		o = s.taboption('advanced', form.Value, 'hook', _('Hook'), _('Command that is run after changes to storage'));
		o.rmempty = true;

		o = s.taboption('advanced', form.DummyValue, '_example_storage_hook', _('Example storage hook'));
		o.depends('hook', '');
		o.cfgvalue = function () {
			return _('([ -d .git ] || git init) && git add -A && (git diff --cached --quiet || git commit -m \'Changes by \'%(user)s');
		};
		o.write = function () {};

		// TODO: Allow configuration of rights file from this page

		s = m.section(form.NamedSection, 'rights', 'section', _('Rights'), _('User-based ACL Settings'));
		s.addremove = true;

		o = s.option(form.ListValue, 'type', _('Rights Type'));
		o.value('', _('Default (owner only)'));
		o.value('owner_only', _('RO: None, RW: Owner'));
		o.value('authenticated', _('RO: None, RW: Authenticated Users'));
		o.value('owner_write', _('RO: Authenticated Users, RW: Owner'));
		o.value('from_file', _('Based on settings in \'Rights File\''));
		o.value('none', _('RO: All, RW: All'));
		o.default = '';
		o.rmempty = true;

		o = s.option(form.FileUpload, 'file', _('Rights File'));
		o.rmempty = true;
		o.depends('type', 'from_file');

		s = m.section(form.NamedSection, 'web', 'section', _('Web UI'));
		s.addremove = true;

		o = s.option(form.ListValue, 'type', _('Web UI Type'));
		o.value('', 'Default (Built-in)');
		o.value('internal', 'Built-in');
		o.value('none', 'None');
		o.default = '';
		o.rmempty = true;

		s = m.section(form.NamedSection, 'headers', 'section', _('Headers'), _('HTTP(S) Headers'));
		s.addremove = true;

		o = s.option(form.Value, 'cors', _('CORS'), _('Header: X-Access-Control-Allow-Origin'));
		o.rmempty = true;
		o.placeholder = '*';

		s = m.section(form.NamedSection, 'encoding', 'section', _('Document Encoding'));
		s.addremove = true;

		o = s.option(form.Value, 'request', _('Request'), _('Encoding for responding to requests/events'));
		o.rmempty = true;
		o.placeholder = 'utf-8';

		o = s.option(form.Value, 'stock', _('Storage'), _('Encoding for storing local collections'));
		o.rmempty = true;
		o.placeholder = 'utf-8';

		s = m.section(form.NamedSection, 'logging', 'section', _('Logging'));
		s.addremove = true;

		s.tab('main', _('Main'));

		o = s.taboption('main', form.ListValue, 'level', _('Log Level'));
		s.rmempty = true;
		o.value('', _('Default (info)'));
		o.value('debug', _('Debug'));
		o.value('info', _('Info'));
		o.value('warning', _('Warning'));
		o.value('error', _('Error'));
		o.value('critical', _('Critical'));
		o.default = '';

		// TODO: Add more logging options

		s.tab('advanced', _('Advanced'));

		o = s.taboption('advanced', form.Flag, 'trace_on_debug', _('Trace on debug'), _('Do not filter debug messages starting with \'TRACE\''));
		o.rmempty = true;
		o.default = o.disabled;
		o.depends('level', 'debug');

		o = s.taboption('advanced', form.Flag, 'mask_passwords', _('Mask Passwords'), _('Redact passwords in logs'));
		o.rmempty = true;
		o.default = o.enabled;

		return m.render();
	},
});
