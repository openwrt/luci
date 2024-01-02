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
		var lhttp = null;
		var lhttps = null;
		var cert_file = null;
		var key_file = null;
		var ucs = null;
		var uhttpdMap = new form.Map('uhttpd', _('uHTTPd'), _('A lightweight single-threaded HTTP(S) server'));

		ucs = uhttpdMap.section(form.TypedSection, 'uhttpd');
		ucs.addremove = true;
		ucs.anonymous = false;

		ucs.tab('general', _('General Settings'));
		ucs.tab('server', _('Full Web Server Settings'), _('For settings primarily geared to serving more than the web UI'));
		ucs.tab('advanced', _('Advanced Settings'), _('Settings which are either rarely needed or which affect serving the WebUI'));

		lhttp = ucs.taboption('general', form.DynamicList, 'listen_http', _('HTTP listeners (address:port)'), _('Bind to specific interface:port (by specifying interface address)'));
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

		lhttps = ucs.taboption('general', form.DynamicList, 'listen_https', _('HTTPS listener (address:port)'), _('Bind to specific interface:port (by specifying interface address)'));
		lhttps.datatype = 'list(ipaddrport(1))';

		var cert = uci.get('uhttpd', 'main', 'cert');
		var key = uci.get('uhttpd', 'main', 'key');

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

		lhttps.depends({ cert, key });

		var httptoHttps = ucs.taboption('general', form.Flag, 'redirect_https', _('Redirect all HTTP to HTTPS'));
		httptoHttps.default = httptoHttps.enabled;
		httptoHttps.rmempty = false;

		var rfc1918Filter = ucs.taboption('general', form.Flag, 'rfc1918_filter', _('Ignore private IPs on public interface'), _('Prevent access from private (RFC1918) IPs on an interface if it has an public IP address'));
		rfc1918Filter.default = rfc1918Filter.enabled;
		rfc1918Filter.rmempty = false;

		cert_file = ucs.taboption('general', form.FileUpload, 'cert', _('HTTPS Certificate (DER or PEM format)'), _('Files can only be uploaded and saved to the /etc/luci-uploads directory.'));
		cert_file.root_directory = '/';
		cert_file.enable_remove = false;

		key_file = ucs.taboption('general', form.FileUpload, 'key', _('HTTPS Private Key (DER or PEM format)'), _('Files can only be uploaded and saved to the /etc/luci-uploads directory.'));
		key_file.root_directory = '/';
		key_file.enable_remove = false;

		var removeOld = ucs.taboption('general', form.Button, 'remove_old', _('Remove old certificate and key'), _('uHTTPd will generate a new self-signed certificate using the configuration shown below.'));
		removeOld.inputstyle = 'remove';

		removeOld.onclick = function (section_id) {
			fs.remove(`${uci.get('uhttpd', 'main', 'cert')}`)
				.then(() => fs.remove(`${uci.get('uhttpd', 'main', 'key')}`))
				.then(() => {
					return fs.exec('/etc/init.d/uhttpd', ['restart']);
				})
				.finally(() => {
					window.location.reload();
				});
		};

		var removeConf = ucs.taboption('general', form.Button, 'remove_conf', _('Remove configuration for certificate and key'), _('This permanently deletes the cert, key, and configuration to use same.'));
		removeConf.inputstyle = 'remove';
		removeConf.onclick = function (section_id) {
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

		var indexPage = ucs.taboption('server', form.DynamicList, 'index_page', _('Index page(s)'), _('E.g specify with index.html and index.php when using PHP'));
		indexPage.optional = true;
		indexPage.placeholder = 'index.html';

		var interpreter = ucs.taboption('server', form.DynamicList, 'interpreter', _('CGI filetype handler'), _("Interpreter to associate with file endings ('suffix=handler', e.g. '.php=/usr/bin/php-cgi')"));
		interpreter.optional = true;

		var noSymlinks = ucs.taboption('server', form.Flag, 'no_symlinks', _('Do not follow symlinks outside document root'));
		noSymlinks.optional = true;

		var noDirlists = ucs.taboption('server', form.Flag, 'no_dirlists', _('Do not generate directory listings.'));
		noDirlists.default = noDirlists.disabled;

		var alias = ucs.taboption('server', form.DynamicList, 'alias', _('Aliases'), _('(/old/path=/new/path) or (just /old/path which becomes /cgi-prefix/old/path)'));
		alias.optional = true;

		var realm = ucs.taboption('server', form.Value, 'realm', _('Realm for Basic Auth'));
		realm.optional = true;
		realm.placeholder = window.location.hostname || 'OpenWrt';

		var httpconfig = ucs.taboption('server', form.Value, 'config', _('Config file (e.g. for credentials for Basic Auth)'), _('Will not use HTTP authentication if not present'));
		httpconfig.optional = true;

		var errorPage = ucs.taboption('server', form.Value, 'error_page', _('404 Error'), _("Virtual URL or CGI script to display on status '404 Not Found'. Must begin with '/'"));
		errorPage.optional = true;

		var docRoot = ucs.taboption('advanced', form.Value, 'home', _('Document root'), _('Base directory for files to be served'));
		docRoot.default = '/www';
		docRoot.datatype = 'directory';

		var cgiPrefix = ucs.taboption('advanced', form.Value, 'cgi_prefix', _('Path prefix for CGI scripts'), _('CGI is disabled if not present.'));
		cgiPrefix.optional = true;

		var luaPrefix = ucs.taboption('advanced', form.Value, 'lua_prefix', _('Virtual path prefix for Lua scripts'));
		luaPrefix.placeholder = '/lua';
		luaPrefix.optional = true;

		var luaHandler = ucs.taboption('advanced', form.Value, 'lua_handler', _('Full real path to handler for Lua scripts'), _('Embedded Lua interpreter is disabled if not present.'));
		luaHandler.optional = true;

		var ubusPrefix = ucs.taboption('advanced', form.Value, 'ubus_prefix', _('Virtual path prefix for ubus via JSON-RPC integration'), _('ubus integration is disabled if not present'));
		ubusPrefix.optional = true;

		var ubusSocket = ucs.taboption('advanced', form.Value, 'ubus_socket', _('Override path for ubus socket'));
		ubusSocket.optional = true;

		var ubusCors = ucs.taboption('advanced', form.Flag, 'ubus_cors', _('Enable JSON-RPC Cross-Origin Resource Support'));
		ubusCors.default = ubusCors.disabled;
		ubusCors.optional = true;

		var noUbusauth = ucs.taboption('advanced', form.Flag, 'no_ubusauth', _('Disable JSON-RPC authorization via ubus session API'));
		noUbusauth.optional = true;
		noUbusauth.default = noUbusauth.disabled;

		var scriptTimeout = ucs.taboption('advanced', form.Value, 'script_timeout', _('Maximum wait time for Lua, CGI, or ubus execution'));
		scriptTimeout.placeholder = 60;
		scriptTimeout.datatype = 'uinteger';
		scriptTimeout.optional = true;

		var networkTimeout = ucs.taboption('advanced', form.Value, 'network_timeout', _('Maximum wait time for network activity'));
		networkTimeout.placeholder = 30;
		networkTimeout.datatype = 'uinteger';
		networkTimeout.optional = true;

		var httpKeepalive = ucs.taboption('advanced', form.Value, 'http_keepalive', _('Connection reuse'));
		httpKeepalive.placeholder = 20;
		httpKeepalive.datatype = 'uinteger';
		httpKeepalive.optional = true;

		var tcpKeepalive = ucs.taboption('advanced', form.Value, 'tcp_keepalive', _('TCP Keepalive'));
		tcpKeepalive.optional = true;
		tcpKeepalive.datatype = 'uinteger';
		tcpKeepalive.default = 1;

		var maxConnections = ucs.taboption('advanced', form.Value, 'max_connections', _('Maximum number of connections'));
		maxConnections.optional = true;
		maxConnections.datatype = 'uinteger';

		var maxRequests = ucs.taboption('advanced', form.Value, 'max_requests', _('Maximum number of script requests'));
		maxRequests.optional = true;
		maxRequests.datatype = 'uinteger';

		var certParam = uhttpdMap.section(form.TypedSection, 'cert', _('uHTTPd Self-signed Certificate Parameters'));

		certParam.template = 'cbi/tsection';
		certParam.anonymous = true;

		var days = certParam.option(form.Value, 'days', _('Valid for # of Days'));
		days.default = 730;
		days.datatype = 'uinteger';

		var bits = certParam.option(form.Value, 'bits', _('Length of key in bits'));
		bits.default = 2048;
		bits.datatype = 'min(1024)';

		var commonname = certParam.option(form.Value, 'commonname', _('Server Hostname'), _('a.k.a CommonName'));
		commonname.default = window.location.hostname || 'OpenWrt';

		var organization = certParam.option(form.Value, 'organization', _('Organization'), _('If empty, a random/unique value is used in cert generation'));

		var location = certParam.option(form.Value, 'location', _('Location'));
		location.default = 'Unknown';

		var state = certParam.option(form.Value, 'state', _('State'));
		state.default = 'Unknown';

		var country = certParam.option(form.Value, 'country', _('Country'));
		country.default = 'ZZ';

		return uhttpdMap.render();
	},
});
