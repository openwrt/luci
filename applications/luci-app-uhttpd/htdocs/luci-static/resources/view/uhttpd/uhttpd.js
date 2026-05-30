'use	strict';
'require	view';
'require	form';
'require	fs';
'require	uci';

return view.extend({
	load: function () {
		return Promise.all([uci.load('uhttpd')]);
	},

	render: function () {
		let m, s, o;

		var lhttp = null;
		var lhttps = null;
		var cert_file = null;
		var key_file = null;
		m = new form.Map('uhttpd', _('uHTTPd'), _('A lightweight single-threaded HTTP(S) server'));

		s = m.section(form.TypedSection, 'uhttpd');
		s.addremove = true;
		s.anonymous = false;

		s.tab('general', _('General Settings'));
		s.tab('server', _('Full Web Server Settings'), _('For settings primarily geared to serving more than the web UI'));
		s.tab('advanced', _('Advanced Settings'), _('Settings which are either rarely needed or which affect serving the WebUI'));

		lhttp = s.taboption('general', form.DynamicList, 'listen_http', _('HTTP listeners (address:port)'), _('Bind to specific interface:port (by specifying interface address)'));
		lhttp.datatype = 'list(ipaddrport(1))';

		lhttp.validate = function (section_id, value) {
			var have_https_listener = false;
			var have_http_listener = false;
			if (lhttp && lhttp.formvalue(section_id) && lhttp.formvalue(section_id).length > 0) {
				lhttp.formvalue(section_id).forEach(function (v) {
					if (v && v !== '') {
						have_http_listener = true;
						return false;
					}
				});
			}
			if (lhttps && lhttps.formvalue(section_id) && lhttps.formvalue(section_id).length > 0) {
				lhttps.formvalue(section_id).forEach(function (v) {
					if (v && v !== '') {
						have_https_listener = true;
						return false;
					}
				});
			}
			if (!(have_http_listener || have_https_listener)) {
				return [null, 'must listen on at least one address:port'];
			}
			return true;
		};

		lhttps = s.taboption('general', form.DynamicList, 'listen_https', _('HTTPS listener (address:port)'), _('Bind to specific interface:port (by specifying interface address)'));
		lhttps.datatype = 'list(ipaddrport(1))';

		lhttps.validate = function (section_id, value) {
			let have_https_listener = false;
			let have_http_listener = false;

			if (lhttps && lhttps.formvalue(section_id) && lhttps.formvalue(section_id).length > 0) {
				lhttps.formvalue(section_id).forEach(function (v) {
					if (v && v !== '') {
						have_https_listener = true;
						return false;
					}
				});
				if (have_https_listener && (!cert_file || !cert_file.formvalue(section_id) || cert_file.formvalue(section_id) === '')) {
					return [null, 'must have certificate when using https'];
				}
				if (have_https_listener && (!key_file || !key_file.formvalue(section_id) || key_file.formvalue(section_id) === '')) {
					return [null, 'must have key when using https'];
				}
			}

			if (lhttp && lhttp.formvalue(section_id) && lhttp.formvalue(section_id).length > 0) {
				lhttp.formvalue(section_id).forEach(function (v) {
					if (v && v !== '') {
						have_http_listener = true;
						return false;
					}
				});
			}

			if (!(have_http_listener || have_https_listener)) {
				return [null, 'must listen on at least one address:port'];
			}

			return true;
		};

		o = s.taboption('general', form.Flag, 'redirect_https', _('Redirect all HTTP to HTTPS'));
		o.default = o.enabled;
		o.rmempty = false;

		o = s.taboption('general', form.Flag, 'rfc1918_filter', _('Ignore private IPs on public interface'), _('Prevent access from private (RFC1918) IPs on an interface if it has an public IP address'));
		o.default = o.enabled;
		o.rmempty = false;

		cert_file = s.taboption('general', form.FileUpload, 'cert', _('HTTPS Certificate (DER or PEM format)'), _('Files can only be uploaded and saved to the /etc/luci-uploads directory.'));
		cert_file.root_directory = '/';
		cert_file.enable_remove = false;

		key_file = s.taboption('general', form.FileUpload, 'key', _('HTTPS Private Key (DER or PEM format)'), _('Files can only be uploaded and saved to the /etc/luci-uploads directory.'));
		key_file.root_directory = '/';
		key_file.enable_remove = false;

		o = s.taboption('general', form.Button, 'remove_old', _('Remove old certificate and key'), _('uHTTPd will generate a new self-signed certificate using the configuration shown below.'));
		o.inputstyle = 'remove';
		o.onclick = function (section_id) {
			fs.remove(`${uci.get('uhttpd', 'main', 'cert')}`)
				.then(() => fs.remove(`${uci.get('uhttpd', 'main', 'key')}`))
				.then(() => {
					return fs.exec('/etc/init.d/uhttpd', ['restart']);
				})
				.finally(() => {
					window.location.reload();
				});
		};

		o = s.taboption('general', form.Button, 'remove_conf', _('Remove configuration for certificate and key'), _('This permanently deletes the cert, key, and configuration to use same.'));
		o.inputstyle = 'remove';
		o.onclick = function (section_id) {
			fs.remove(`${uci.get('uhttpd', 'main', 'cert')}`)
				.then(() => fs.remove(`${uci.get('uhttpd', 'main', 'key')}`))
				.then(() => {
					uci.unset('uhttpd', 'main', 'cert');
					uci.unset('uhttpd', 'main', 'key');
					uci.unset('uhttpd', 'main', 'listen_https');
					return uci.save();
				})
				.then(() => {
					return fs.exec('/etc/init.d/uhttpd', ['restart']);
				})
				.finally(() => {
					window.location.reload();
				});
		};

		o = s.taboption('server', form.DynamicList, 'index_page', _('Index page(s)'), _('E.g specify with index.html and index.php when using PHP'));
		o.optional = true;
		o.placeholder = 'index.html';

		o = s.taboption('server', form.DynamicList, 'interpreter', _('CGI filetype handler'), _("Interpreter to associate with file endings ('suffix=handler', e.g. '.php=/usr/bin/php-cgi')"));
		o.optional = true;

		o = s.taboption('server', form.Flag, 'no_symlinks', _('Do not follow symlinks outside document root'));
		o.optional = true;

		o = s.taboption('server', form.Flag, 'no_dirlists', _('Do not generate directory listings.'));
		o.default = o.disabled;

		o = s.taboption('server', form.DynamicList, 'alias', _('Aliases'), _('(/old/path=/new/path) or (just /old/path which becomes /cgi-prefix/old/path)'));
		o.optional = true;

		o = s.taboption('server', form.Value, 'realm', _('Realm for Basic Auth'));
		o.optional = true;
		o.placeholder = window.location.hostname || 'OpenWrt';

		o = s.taboption('server', form.Value, 'config', _('Config file (e.g. for credentials for Basic Auth)'), _('Will not use HTTP authentication if not present'));
		o.optional = true;

		o = s.taboption('server', form.Value, 'error_page', _('404 Error'), _("Virtual URL or CGI script to display on status '404 Not Found'. Must begin with '/'"));
		o.optional = true;

		o = s.taboption('advanced', form.Value, 'home', _('Document root'), _('Base directory for files to be served'));
		o.default = '/www';
		o.datatype = 'directory';

		o = s.taboption('advanced', form.Value, 'cgi_prefix', _('Path prefix for CGI scripts'), _('CGI is disabled if not present.'));
		o.optional = true;

		o = s.taboption('advanced', form.Value, 'lua_prefix', _('Virtual path prefix for Lua scripts'));
		o.placeholder = '/lua';
		o.optional = true;

		o = s.taboption('advanced', form.Value, 'lua_handler', _('Full real path to handler for Lua scripts'), _('Embedded Lua interpreter is disabled if not present.'));
		o.optional = true;

		o = s.taboption('advanced', form.Value, 'ubus_prefix', _('Virtual path prefix for ubus via JSON-RPC integration'), _('ubus integration is disabled if not present'));
		o.optional = true;

		o = s.taboption('advanced', form.Value, 'ubus_socket', _('Override path for ubus socket'));
		o.optional = true;

		o = s.taboption('advanced', form.Flag, 'ubus_cors', _('Enable JSON-RPC Cross-Origin Resource Support'));
		o.default = o.disabled;
		o.optional = true;

		o = s.taboption('advanced', form.Flag, 'no_ubusauth', _('Disable JSON-RPC authorization via ubus session API'));
		o.optional = true;
		o.default = o.disabled;

		o = s.taboption('advanced', form.Value, 'script_timeout', _('Maximum wait time for Lua, CGI, or ubus execution'));
		o.placeholder = 60;
		o.datatype = 'uinteger';
		o.optional = true;

		o = s.taboption('advanced', form.Value, 'network_timeout', _('Maximum wait time for network activity'));
		o.placeholder = 30;
		o.datatype = 'uinteger';
		o.optional = true;

		o = s.taboption('advanced', form.Value, 'http_keepalive', _('Connection reuse'));
		o.placeholder = 20;
		o.datatype = 'uinteger';
		o.optional = true;

		o = s.taboption('advanced', form.Value, 'tcp_keepalive', _('TCP Keepalive'));
		o.optional = true;
		o.datatype = 'uinteger';
		o.default = 1;

		o = s.taboption('advanced', form.Value, 'max_connections', _('Maximum number of connections'));
		o.optional = true;
		o.datatype = 'uinteger';

		o = s.taboption('advanced', form.Value, 'max_requests', _('Maximum number of script requests'));
		o.optional = true;
		o.datatype = 'uinteger';

		s = m.section(form.TypedSection, 'cert', _('uHTTPd Self-signed Certificate Parameters'));
		s.template = 'cbi/tsection';
		s.anonymous = true;

		o = s.option(form.Value, 'days', _('Valid for # of Days'));
		o.default = 730;
		o.datatype = 'uinteger';

		o = s.option(form.Value, 'bits', _('Length of key in bits'));
		o.default = 2048;
		o.datatype = 'min(1024)';

		o = s.option(form.Value, 'commonname', _('Server Hostname'), _('a.k.a CommonName'));
		o.default = window.location.hostname || 'OpenWrt';

		o = s.option(form.Value, 'organization', _('Organization'), _('If empty, a random/unique value is used in cert generation'));

		o = s.option(form.Value, 'location', _('Location'));
		o.default = 'Unknown';

		o = s.option(form.Value, 'state', _('State'));
		o.default = 'Unknown';

		o = s.option(form.Value, 'country', _('Country'));
		o.default = 'ZZ';

		return m.render();
	},
});
