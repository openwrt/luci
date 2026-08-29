'use strict';
'require view';
'require form';
'require rpc';
'require tools.widgets as widgets';

/*
 * Important:
 *
 * This LuCI page writes UCI options into /etc/config/frps.
 * UCI option names must not contain ".".
 *
 * Therefore we keep UCI-safe option names here, then let init/generator script
 * convert them to frp TOML keys, for example:
 *
 *   bind_addr             -> bindAddr
 *   bind_port             -> bindPort
 *   kcp_bind_port         -> kcpBindPort
 *   quic_bind_port        -> quicBindPort
 *   admin_port            -> webServer.port
 *   admin_tls_cert_file   -> webServer.tls.certFile
 *   tls_force             -> transport.tls.force
 *   max_pool_count        -> transport.maxPoolCount
 *   authentication_method -> auth.method
 *   token_source_type   -> auth.tokenSource.type
 *
 * Do NOT use option names like "webServer.port" in LuCI form options.
 */

/*
 * Debug-only TOML mapping. Keep these TOML: hints in the JS source for
 * troubleshooting generated configs, but do not show them in LuCI form text
 * and do not wrap them in _().
 *
 * common.bind_addr -> TOML: bindAddr
 * common.bind_port -> TOML: bindPort
 * common.kcp_bind_port -> TOML: kcpBindPort
 * common.quic_bind_port -> TOML: quicBindPort
 * common.proxy_bind_addr -> TOML: proxyBindAddr
 * common.vhost_http_port -> TOML: vhostHTTPPort
 * common.vhost_https_port -> TOML: vhostHTTPSPort
 * common.vhost_http_timeout -> TOML: vhostHTTPTimeout
 * common.tcpmux_httpconnect_port -> TOML: tcpmuxHTTPConnectPort
 * common.tcpmux_passthrough -> TOML: tcpmuxPassthrough
 * common.subdomain_host -> TOML: subDomainHost
 * common.custom_404_page -> TOML: custom404Page
 * common.udp_packet_size -> TOML: udpPacketSize
 * common.detailed_errors_to_client -> TOML: detailedErrorsToClient
 * common.user_conn_timeout -> TOML: userConnTimeout
 * common.nathole_analysis_data_reserve_hours -> TOML: natholeAnalysisDataReserveHours
 * common.authentication_method -> TOML: auth.method
 * common.token -> TOML: auth.token
 * common.auth_additional_scopes -> TOML: auth.additionalScopes
 * common.token_source_type -> TOML: auth.tokenSource.type
 * common.token_source_file_path -> TOML: auth.tokenSource.file.path
 * common.token_source_exec_command -> TOML: auth.tokenSource.exec.command
 * common.token_source_exec_args -> TOML: auth.tokenSource.exec.args
 * common.token_source_exec_env -> TOML: auth.tokenSource.exec.env
 * common.oidc_issuer -> TOML: auth.oidc.issuer
 * common.oidc_audience -> TOML: auth.oidc.audience
 * common.oidc_skip_expiry_check -> TOML: auth.oidc.skipExpiryCheck
 * common.oidc_skip_issuer_check -> TOML: auth.oidc.skipIssuerCheck
 * common.max_pool_count -> TOML: transport.maxPoolCount
 * common.tcp_mux -> TOML: transport.tcpMux
 * common.tcp_mux_keepalive_interval -> TOML: transport.tcpMuxKeepaliveInterval
 * common.tcp_keepalive -> TOML: transport.tcpKeepalive
 * common.heartbeat_timeout -> TOML: transport.heartbeatTimeout
 * common.tls_force -> TOML: transport.tls.force
 * common.tls_cert_file -> TOML: transport.tls.certFile
 * common.tls_key_file -> TOML: transport.tls.keyFile
 * common.tls_trusted_ca_file -> TOML: transport.tls.trustedCaFile
 * common.quic_keepalive_period -> TOML: transport.quic.keepalivePeriod
 * common.quic_max_idle_timeout -> TOML: transport.quic.maxIdleTimeout
 * common.quic_max_incoming_streams -> TOML: transport.quic.maxIncomingStreams
 * common.admin_addr -> TOML: webServer.addr
 * common.admin_port -> TOML: webServer.port
 * common.admin_user -> TOML: webServer.user
 * common.admin_pwd -> TOML: webServer.password
 * common.admin_tls_cert_file -> TOML: webServer.tls.certFile
 * common.admin_tls_key_file -> TOML: webServer.tls.keyFile
 * common.assets_dir -> TOML: webServer.assetsDir
 * common.pprof_enable -> TOML: webServer.pprofEnable
 * common.enable_prometheus -> TOML: enablePrometheus
 * common.allow_ports -> TOML: allowPorts
 * common.max_ports_per_client -> TOML: maxPortsPerClient
 * common.ssh_tunnel_bind_port -> TOML: sshTunnelGateway.bindPort
 * common.ssh_tunnel_private_key_file -> TOML: sshTunnelGateway.privateKeyFile
 * common.ssh_tunnel_auto_gen_private_key_path -> TOML: sshTunnelGateway.autoGenPrivateKeyPath
 * common.ssh_tunnel_authorized_keys_file -> TOML: sshTunnelGateway.authorizedKeysFile
 * common.log_file -> TOML: log.to
 * common.log_level -> TOML: log.level
 * common.log_max_days -> TOML: log.maxDays
 * common.disable_log_color -> TOML: log.disablePrintColor
 * http_plugin.name -> TOML: httpPlugins[].name
 * http_plugin.addr -> TOML: httpPlugins[].addr
 * http_plugin.path -> TOML: httpPlugins[].path
 * http_plugin.ops -> TOML: httpPlugins[].ops
 * http_plugin.tls_verify -> TOML: httpPlugins[].tlsVerify
 */

const startupConf = [
	[form.Flag, 'stdout', _('Log stdout'), null,
	{
		enabled: '1',
		disabled: '0',
		default: '1',
		rmempty: false,
		retain: true,
		remove: writeFlagDisabled
	}],

	[form.Flag, 'stderr', _('Log stderr'), null,
	{
		enabled: '1',
		disabled: '0',
		default: '1',
		rmempty: false,
		retain: true,
		remove: writeFlagDisabled
	}],

	[widgets.UserSelect, 'user', _('Run daemon as user')],
	[widgets.GroupSelect, 'group', _('Run daemon as group')],

	[form.Flag, 'respawn', _('Respawn when crashed'), null,
	{
		enabled: '1',
		disabled: '0',
		default: '1',
		rmempty: false,
		retain: true,
		remove: writeFlagDisabled
	}],

	[form.DynamicList, 'env', _('Environment variable'),
	_('OS environments passed to frp for config file template, see %s.').format('<a href="https://github.com/fatedier/frp#configuration-file-template">frp README</a>'),
	{
		placeholder: 'ENV_NAME=value',
		validate: function (section_id, value) {
			return validateEnv(value);
		}
	}],

	[form.DynamicList, 'conf_inc', _('Additional configs'),
	_('Extra root-level configuration fragments included before generated HTTP plugin sections. Use raw settings for table-specific extra options.'),
	{
		datatype: 'file',
		placeholder: '/etc/frp/frps.d/frps_extra.toml'
	}]
];

const commonBaseConf = [
	[form.Value, 'bind_addr', _('Bind address'),
	_('Address that frps binds to.'),
	{ datatype: 'host', placeholder: '0.0.0.0' }],

	[form.Value, 'bind_port', _('Bind port'),
	_('Port that frps listens on.'),
	{ datatype: 'port', rmempty: false, placeholder: '7000' }],

	[form.Value, 'kcp_bind_port', _('KCP bind port'),
	_('UDP port used for KCP. Empty disables KCP. Do not reuse the same UDP port as QUIC.'),
	{
		placeholder: '7000',
		validate: function (section_id, value) {
			const portValid = validatePortOrZero(section_id, value);
			if (portValid !== true)
				return portValid;

			const quic = this.section.getOption('quic_bind_port');
			const quicValue = quic ? quic.formvalue(section_id) : null;

			if (value && value !== '0' && quicValue && quicValue !== '0' && value === quicValue)
				return _('KCP bind port and QUIC bind port must be different.');

			return true;
		}
	}],

	[form.Value, 'quic_bind_port', _('QUIC bind port'),
	_('UDP port used for QUIC. Empty disables QUIC. Do not reuse the same UDP port as KCP.'),
	{
		placeholder: '7002',
		validate: function (section_id, value) {
			const portValid = validatePortOrZero(section_id, value);
			if (portValid !== true)
				return portValid;

			const kcp = this.section.getOption('kcp_bind_port');
			const kcpValue = kcp ? kcp.formvalue(section_id) : null;

			if (value && value !== '0' && kcpValue && kcpValue !== '0' && value === kcpValue)
				return _('KCP bind port and QUIC bind port must be different.');

			return true;
		}
	}],

	[form.Value, 'proxy_bind_addr', _('Proxy bind address'),
	_('Address that proxy listeners bind to.'),
	{ datatype: 'host', placeholder: '0.0.0.0' }],

	[form.Value, 'vhost_http_port', _('Vhost HTTP port'),
	_('Port for HTTP virtual host requests. Empty or 0 disables it.'),
	{ validate: validatePortOrZero, placeholder: '80' }],

	[form.Value, 'vhost_https_port', _('Vhost HTTPS port'),
	_('Port for HTTPS virtual host requests. Empty or 0 disables it.'),
	{ validate: validatePortOrZero, placeholder: '443' }],

	[form.Value, 'vhost_http_timeout', _('Vhost HTTP timeout'),
	_('Response header timeout for vhost HTTP server, in seconds.'),
	{ datatype: 'uinteger', placeholder: '60' }],

	[form.Value, 'tcpmux_httpconnect_port', _('TCPMUX HTTP CONNECT port'),
	_('Port for TCPMUX HTTP CONNECT requests. Empty or 0 disables it.'),
	{ validate: validatePortOrZero, placeholder: '0' }],

	[form.Flag, 'tcpmux_passthrough', _('TCPMUX passthrough'),
	_('Do not update traffic when TCPMUX passthrough is enabled.'),
	{ datatype: 'bool', default: 'false' }],

	[form.Value, 'subdomain_host', _('Subdomain host'),
	_('Domain suffix for subdomain-based HTTP/HTTPS proxies.'),
	{ placeholder: 'frps.com' }],

	[form.Value, 'custom_404_page', _('Custom 404 page'),
	_('Path to custom 404 page for HTTP requests.'),
	{ datatype: 'file' }],

	[form.Value, 'udp_packet_size', _('UDP packet size'),
	_('UDP packet size in bytes. Should match frpc.'),
	{ datatype: 'uinteger', placeholder: '1500' }]
];

const commonAuthConf = [
	[form.ListValue, 'authentication_method', _('Authentication method'),
	_('Authentication method used to authenticate frpc.'),
	{ values: [['token', 'token'], ['oidc', 'oidc']], default: 'token' }],

	[form.Value, 'token', _('Token'),
	_('Token used for authentication.'),
	{
		depends: { authentication_method: 'token' },
		password: true,
		validate: function (section_id, value) {
			const tokenSourceType = this.section.getOption('token_source_type');

			if (value && tokenSourceType && tokenSourceType.formvalue(section_id))
				return _('Token and token source are mutually exclusive.');

			return true;
		}
	}],

	[form.MultiValue, 'auth_additional_scopes', _('Additional auth scopes'),
	_('Additional scopes to include authentication information.'),
	{ values: ['HeartBeats', 'NewWorkConns'] }],

	[form.ListValue, 'token_source_type', _('Token source type'),
	_('Load token from an external source. File reads the token from a local file; exec runs a command and requires frp unsafe permission. Mutually exclusive with auth.token.'),
	{
		depends: { authentication_method: 'token' },
		values: [['', _('Disabled')], ['file', 'file'], ['exec', 'exec']],
		rmempty: true,
		validate: function (section_id, value) {
			const token = this.section.getOption('token');

			if (value && token && token.formvalue(section_id))
				return _('Token and token source are mutually exclusive.');

			return true;
		}
	}],

	[form.Value, 'token_source_file_path', _('Token source file'),
	_('Path of token file.'),
	{
		depends: {
			authentication_method: 'token',
			token_source_type: 'file'
		},
		datatype: 'file',
		rmempty: false,
		validate: function (section_id, value) {
			const tokenSourceType = this.section.getOption('token_source_type');

			if (
				tokenSourceType &&
				tokenSourceType.formvalue(section_id) === 'file' &&
				!String(value || '').trim()
			)
				return _('Token source file path is required when token source type is file.');

			return true;
		}
	}],

	[form.Value, 'token_source_exec_command', _('Token source command'),
	_('Command used to obtain the token. The init script adds --allow-unsafe=TokenSourceExec when this source type is used.'),
	{
		depends: {
			authentication_method: 'token',
			token_source_type: 'exec'
		},
		datatype: 'file',
		rmempty: false,
		validate: function (section_id, value) {
			const tokenSourceType = this.section.getOption('token_source_type');

			if (
				tokenSourceType &&
				tokenSourceType.formvalue(section_id) === 'exec' &&
				!String(value || '').trim()
			)
				return _('Token source command is required when token source type is exec.');

			return true;
		}
	}],

	[form.DynamicList, 'token_source_exec_args', _('Token source command arguments'),
	_('Command arguments passed to token source exec.'),
	{
		depends: {
			authentication_method: 'token',
			token_source_type: 'exec'
		},
		placeholder: '--format'
	}],

	[form.DynamicList, 'token_source_exec_env', _('Token source environment'),
	_('Environment variables passed to token source exec. Use KEY=value.'),
	{
		depends: {
			authentication_method: 'token',
			token_source_type: 'exec'
		},
		placeholder: 'TOKEN_SERVICE=production',
		validate: function (section_id, value) {
			return validateEnv(value);
		}
	}],

	[form.Value, 'oidc_issuer', _('OIDC issuer'),
	_('OIDC issuer used to verify tokens.'),
	{ depends: { authentication_method: 'oidc' } }],

	[form.Value, 'oidc_audience', _('OIDC audience'),
	_('Audience OIDC tokens should contain.'),
	{ depends: { authentication_method: 'oidc' } }],

	[form.Flag, 'oidc_skip_expiry_check', _('OIDC skip expiry check'),
	_('Skip checking whether the OIDC token is expired.'),
	{ depends: { authentication_method: 'oidc' }, datatype: 'bool', default: 'false' }],

	[form.Flag, 'oidc_skip_issuer_check', _('OIDC skip issuer check'),
	_('Skip checking whether OIDC token issuer matches configured issuer.'),
	{ depends: { authentication_method: 'oidc' }, datatype: 'bool', default: 'false' }]
];

const commonLogConf = [
	[form.Value, 'log_file', _('Log output'),
	_('Log output path or console.'),
	{ placeholder: 'console' }],

	[form.ListValue, 'log_level', _('Log level'),
	_('Configuration key: log.level.'),
	{ values: ['trace', 'debug', 'info', 'warn', 'error'], default: 'info' }],

	[form.Value, 'log_max_days', _('Log max days'),
	_('Maximum number of days to keep logs.'),
	{ datatype: 'uinteger', placeholder: '3' }],

	[form.Flag, 'disable_log_color', _('Disable log color'),
	_('Disable log colors when log output is console.'),
	{ datatype: 'bool', default: 'false' }]
];

const commonWebConf = [
	[form.Value, 'admin_addr', _('Web server address'),
	_('Web server bind address.'),
	{ datatype: 'host', placeholder: '127.0.0.1' }],

	[form.Value, 'admin_port', _('Web server port'),
	_('Web server port. Leave empty or set to 0 to disable the web server.'),
	{ validate: validatePortOrZero, placeholder: '7500' }],

	[form.Value, 'admin_user', _('Web server user'),
	_('Web server username.'),
	{
		placeholder: 'admin'
	}],

	[form.Value, 'admin_pwd', _('Web server password'),
	_('Web server password.'),
	{
		password: true,
		placeholder: 'change_me_to_a_strong_password'
	}],

	[form.Flag, 'admin_tls_enable', _('Enable web HTTPS'),
	_('Enable HTTPS for the frps web server. This switch controls whether webServer.tls.certFile and webServer.tls.keyFile are emitted.'),
	{
		enabled: 'true',
		disabled: 'false',
		default: 'false',
		rmempty: false,
		retain: true,
		remove: writeFlagDisabled
	}],

	[form.Value, 'admin_tls_cert_file', _('TLS certificate path'),
	_('Path to the certificate file used by the HTTPS web server.'),
	{
		datatype: 'file',
		retain: true,
		placeholder: '/etc/ssl/acme/example.com.fullchain.crt',
		validate: function (section_id, value) {
			if (
				adminWebEnabled(this.section, section_id) &&
				adminHttpsEnabled(this.section, section_id) &&
				!String(value || '').trim()
			)
				return _('TLS certificate path is required when web HTTPS is enabled.');

			return true;
		}
	}],

	[form.Value, 'admin_tls_key_file', _('TLS private key path'),
	_('Path to the private key file used by the HTTPS web server.'),
	{
		datatype: 'file',
		retain: true,
		placeholder: '/etc/ssl/acme/example.com.key',
		validate: function (section_id, value) {
			if (
				adminWebEnabled(this.section, section_id) &&
				adminHttpsEnabled(this.section, section_id) &&
				!String(value || '').trim()
			)
				return _('TLS private key path is required when web HTTPS is enabled.');

			return true;
		}
	}],

	[form.Value, 'assets_dir', _('Assets dir'),
	_('Web server assets directory.'),
	{ datatype: 'directory' }],

	[form.Flag, 'pprof_enable', _('Enable pprof'),
	_('Enable Go pprof debug/profiling endpoints on the web server. It only takes effect when web server port is set.'),
	{
		datatype: 'bool',
		default: 'false',
		rmempty: false,
		retain: true,
		remove: writeFlagDisabled
	}],

	[form.Flag, 'enable_prometheus', _('Enable Prometheus'),
	_('Export Prometheus metrics on webServer /metrics API. It only takes effect when web server port is set.'),
	{
		datatype: 'bool',
		default: 'false',
		rmempty: false,
		retain: true,
		remove: writeFlagDisabled
	}]
];

const commonTransportConf = [
	[form.Value, 'max_pool_count', _('Max pool count'),
	_('Maximum pool count for each proxy.'),
	{ datatype: 'uinteger', placeholder: '5' }],

	[form.Flag, 'tcp_mux', _('TCP mux'),
	_('Enable TCP stream multiplexing. This setting must match frpc.'),
	{
		enabled: 'true',
		disabled: 'false',
		default: 'true',
		optional: false,
		rmempty: false,
		retain: true,
		remove: writeFlagDisabled
	}],

	[form.Value, 'tcp_mux_keepalive_interval', _('TCP mux keepalive interval'),
	_('Keepalive interval for TCP mux.'),
	{ datatype: 'uinteger', placeholder: '30' }],

	[form.Value, 'tcp_keepalive', _('TCP keepalive'),
	_('TCP keepalive interval. Negative value disables keepalive.'),
	{ datatype: 'integer', placeholder: '7200' }],

	[form.Value, 'heartbeat_timeout', _('Heartbeat timeout'),
	_('Heartbeat timeout in seconds.'),
	{ datatype: 'integer', placeholder: '90' }],

	[form.Value, 'user_conn_timeout', _('User connection timeout'),
	_('Maximum time to wait for a work connection.'),
	{ datatype: 'uinteger', placeholder: '10' }],

	[form.Flag, 'detailed_errors_to_client', _('Detailed errors to client'),
	_('Send specific error details to frpc.'),
	{
		enabled: 'true',
		disabled: 'false',
		default: 'true',
		optional: false,
		rmempty: false,
		retain: true,
		remove: writeFlagDisabled
	}]
];

const commonTlsQuicConf = [
	[form.Flag, 'tls_force', _('Force TLS'),
	_('Only accept TLS-encrypted frpc connections.'),
	{ datatype: 'bool', default: 'false' }],

	[form.Value, 'tls_cert_file', _('TLS certificate path'),
	_('Path to the TLS certificate file.'),
	{ datatype: 'file', placeholder: '/etc/ssl/frp/server.crt' }],

	[form.Value, 'tls_key_file', _('TLS private key path'),
	_('Path to the TLS private key file.'),
	{ datatype: 'file', placeholder: '/etc/ssl/frp/server.key' }],

	[form.Value, 'tls_trusted_ca_file', _('TLS trusted CA path'),
	_('Path to the trusted CA certificate file.'),
	{ datatype: 'file', placeholder: '/etc/ssl/frp/ca.crt' }],

	[form.Value, 'quic_keepalive_period', _('QUIC keepalive period'),
	_('Configuration key: transport.quic.keepalivePeriod.'),
	{ datatype: 'uinteger', placeholder: '10' }],

	[form.Value, 'quic_max_idle_timeout', _('QUIC max idle timeout'),
	_('Configuration key: transport.quic.maxIdleTimeout.'),
	{ datatype: 'uinteger', placeholder: '30' }],

	[form.Value, 'quic_max_incoming_streams', _('QUIC max incoming streams'),
	_('Configuration key: transport.quic.maxIncomingStreams.'),
	{ datatype: 'uinteger', placeholder: '100000' }]
];

const commonAccessConf = [
	[form.DynamicList, 'allow_ports', _('Allow ports'),
	_('Ports clients are allowed to bind. Use single port like 3001 or range like 2000-3000.'),
	{
		placeholder: '2000-3000',
		validate: function (section_id, value) {
			return validatePortRange(value);
		}
	}],

	[form.Value, 'max_ports_per_client', _('Max ports per client'),
	_('Maximum ports each client can use. 0 means no limit.'),
	{ datatype: 'uinteger', placeholder: '0' }],

	[form.Value, 'nathole_analysis_data_reserve_hours', _('NAT hole analysis reserve hours'),
	_('Retention time for NAT hole punching strategy data.'),
	{ datatype: 'uinteger', placeholder: '168' }]
];

const commonSshTunnelConf = [
	[form.Value, 'ssh_tunnel_bind_port', _('SSH tunnel bind port'),
	_('SSH tunnel gateway bind port. Empty disables this feature.'),
	{ validate: validatePortOrZero, placeholder: '2200' }],

	[form.Value, 'ssh_tunnel_private_key_file', _('SSH tunnel private key file'),
	_('Private key file for SSH tunnel gateway.'),
	{ datatype: 'file' }],

	[form.Value, 'ssh_tunnel_auto_gen_private_key_path', _('SSH tunnel auto-generated private key path'),
	_('Path for auto-generated private key.'),
	{ datatype: 'file' }],

	[form.Value, 'ssh_tunnel_authorized_keys_file', _('SSH tunnel authorized keys file'),
	_('Authorized keys file for SSH tunnel gateway.'),
	{ datatype: 'file' }]
];

const httpPluginConf = [
	[form.Value, 'name', _('Plugin name'),
	_('Unique HTTP plugin name.'),
	{ rmempty: false, optional: false }],

	[form.Value, 'addr', _('Plugin address'),
	_('HTTP plugin backend address.'),
	{
		placeholder: '127.0.0.1:9000',
		rmempty: false,
		optional: false,
		validate: function (section_id, value) {
			return validateHttpPluginAddr(value);
		}
	}],

	[form.Value, 'path', _('Plugin path'),
	_('HTTP plugin request path.'),
	{
		placeholder: '/handler',
		rmempty: false,
		optional: false,
		validate: function (section_id, value) {
			return validateHttpPath(value);
		}
	}],

	[form.MultiValue, 'ops', _('Plugin operations'),
	_('frps operations handled by this HTTP plugin.'),
	{
		values: ['Login', 'NewProxy', 'CloseProxy', 'Ping', 'NewWorkConn', 'NewUserConn'],
		default: ['Login'],
		optional: false,
		rmempty: false,
		validate: function (section_id, value) {
			return validateHttpPluginOp(value);
		}
	}],

	[form.Flag, 'tls_verify', _('Verify plugin TLS'),
	_('Verify the HTTP plugin TLS certificate when the plugin address uses HTTPS.'),
	{ datatype: 'bool', default: 'false' }]
];

function writeFlagDisabled(section_id) {
	return this.write(section_id, this.disabled || 'false');
}

function removeIfPresent(section_id) {
	const this_cfg = this.uciconfig || this.section.uciconfig || this.map.config;
	const this_sid = this.ucisection || section_id;
	const this_opt = this.ucioption || this.option;

	for (let i = 0; i < this.section.children.length; i++) {
		const sibling = this.section.children[i];

		if (sibling === this || sibling.ucioption == null)
			continue;

		const sibling_cfg = sibling.uciconfig || sibling.section.uciconfig || sibling.map.config;
		const sibling_sid = sibling.ucisection || section_id;
		const sibling_opt = sibling.ucioption || sibling.option;

		if (this_cfg != sibling_cfg || this_sid != sibling_sid || this_opt != sibling_opt)
			continue;

		if (typeof sibling.isActive === 'function' && sibling.isActive(section_id))
			return Promise.resolve();
	}

	if (this.map.data.get(this_cfg, this_sid, this_opt) == null)
		return Promise.resolve();

	return this.map.data.unset(this_cfg, this_sid, this_opt);
}

function isUciDeleteNotFoundError(err) {
	const message = err && err.message ? err.message : String(err);

	return /uci\/delete/.test(message) && /ubus code 4/.test(message);
}

function guardUciDeleteNotFound(data, config) {
	data._frpIgnoreMissingDeleteConfigs ??= {};
	data._frpIgnoreMissingDeleteConfigs[config] = true;

	if (data._frpIgnoreMissingDeleteInstalled)
		return;

	const callDelete = data.callDelete;

	data.callDelete = function(conf, sid, options) {
		const guarded = this._frpIgnoreMissingDeleteConfigs && this._frpIgnoreMissingDeleteConfigs[conf];

		return callDelete.apply(this, arguments).catch(L.bind(function(err) {
			if (!guarded || !isUciDeleteNotFoundError(err))
				return Promise.reject(err);

			if (!Array.isArray(options) || options.length <= 1)
				return null;

			return Promise.all(options.map(L.bind(function(opt) {
				return callDelete.call(this, conf, sid, [ opt ]).catch(function(e) {
					return isUciDeleteNotFoundError(e) ? null : Promise.reject(e);
				});
			}, this)));
		}, this));
	};

	data._frpIgnoreMissingDeleteInstalled = true;
}

function adminWebEnabled(section, section_id) {
	const port = section.getOption('admin_port');
	const value = port ? port.formvalue(section_id) : null;

	return !!(value && value !== '0');
}

function adminHttpsEnabled(section, section_id) {
	const enable = section.getOption('admin_tls_enable');

	return !!(enable && enable.formvalue(section_id) === 'true');
}

function validatePortOrZero(section_id, value) {
	if (!value)
		return true;

	value = String(value).trim();

	if (!/^\d+$/.test(value))
		return _('Port must be a number between 0 and 65535.');

	const port = Number(value);
	if (port < 0 || port > 65535)
		return _('Port must be between 0 and 65535.');

	return true;
}

function validatePortRange(value) {
	if (!value)
		return true;

	value = String(value).trim();

	const m = value.match(/^(\d+)(?:-(\d+))?$/);
	if (!m)
		return _('Use a single port like 3001 or a range like 2000-3000.');

	const start = Number(m[1]);
	const end = Number(m[2] || m[1]);

	if (start < 1 || start > 65535 || end < 1 || end > 65535)
		return _('Port must be between 1 and 65535.');

	if (start > end)
		return _('Port range start must not be greater than end.');

	return true;
}

function validateEnv(value) {
	if (!value)
		return true;

	if (/\r|\n/.test(String(value)) || !/^[A-Za-z_][A-Za-z0-9_]*=.*$/.test(String(value)))
		return _('Environment variable must use KEY=value format.');

	return true;
}

function validateHttpPath(value) {
	if (!value)
		return true;

	if (/\r|\n/.test(String(value)) || String(value).charAt(0) !== '/')
		return _('HTTP plugin path must start with /.');

	return true;
}

function validateHttpPluginAddr(value) {
	if (!value)
		return true;

	value = String(value).trim();

	if (/\r|\n/.test(value))
		return _('HTTP plugin address must be a single address.');

	if (/^https?:\/\//.test(value)) {
		if (!/^https?:\/\/[^\s/:]+(?::\d+)?(?:\/.*)?$/.test(value) && !/^https?:\/\/\[[0-9A-Fa-f:.]+\](?::\d+)?(?:\/.*)?$/.test(value))
			return _('HTTP plugin URL must include a host.');

		return true;
	}

	if (/^[^\s/:]+:\d+$/.test(value) || /^\[[0-9A-Fa-f:.]+\]:\d+$/.test(value))
		return true;

	return _('HTTP plugin address must be host:port or an http:// or https:// URL.');
}

function validateHttpPluginOp(value) {
	if (!value)
		return true;

	if (!/^[A-Za-z][A-Za-z0-9]*$/.test(String(value)))
		return _('HTTP plugin operation must be a frps operation name, for example Login or NewProxy.');

	return true;
}

function normalizeDepends(depends) {
	if (depends == null)
		return [];

	return Array.isArray(depends) ? depends : [ depends ];
}

function mergeDepends(existing, next) {
	const current = normalizeDepends(existing);
	const incoming = normalizeDepends(next);

	if (current.length === 0)
		return incoming;

	if (incoming.length === 0)
		return current;

	const merged = [];

	for (let oldDep of current) {
		for (let newDep of incoming) {
			const dep = {};
			let conflict = false;

			for (let key in oldDep)
				dep[key] = oldDep[key];

			for (let key in newDep) {
				if (Object.prototype.hasOwnProperty.call(dep, key) && dep[key] !== newDep[key]) {
					conflict = true;
					break;
				}

				dep[key] = newDep[key];
			}

			if (!conflict)
				merged.push(dep);
		}
	}

	return merged;
}

function setParams(o, params) {
	if (!params)
		return;

	for (let key in params) {
		let val = params[key];

		if (key === 'values') {
			for (let v of val) {
				let args = v;

				if (!Array.isArray(args))
					args = [args];

				o.value.apply(o, args);
			}
		} else if (key === 'depends') {
			o.deps = mergeDepends(o.deps, val);
		} else {
			o[key] = params[key];
		}
	}

	if (params['datatype'] === 'bool') {
		o.enabled = 'true';
		o.disabled = 'false';
	}
}


function defTabOpts(s, t, opts, params) {
	for (let opt of opts) {
		const o = s.taboption(t, opt[0], opt[1], opt[2], opt[3]);

		setParams(o, opt[4]);
		setParams(o, params);

		/*
		 * Per-option optional must win over tab-wide optional.
		 * This is important for form.Flag with default='true',
		 * otherwise LuCI may treat checked state as default and call remove().
		 */
		if (opt[4] && Object.prototype.hasOwnProperty.call(opt[4], 'optional'))
			o.optional = opt[4].optional;

		if (
			!(opt[4] && Object.prototype.hasOwnProperty.call(opt[4], 'remove')) &&
			!(params && Object.prototype.hasOwnProperty.call(params, 'remove'))
		)
			o.remove = removeIfPresent;
	}
}

function defOpts(s, opts, params) {
	for (let opt of opts) {
		const o = s.option(opt[0], opt[1], opt[2], opt[3]);

		setParams(o, opt[4]);
		setParams(o, params);

		if (opt[4] && Object.prototype.hasOwnProperty.call(opt[4], 'optional'))
			o.optional = opt[4].optional;

		if (
			!(opt[4] && Object.prototype.hasOwnProperty.call(opt[4], 'remove')) &&
			!(params && Object.prototype.hasOwnProperty.call(params, 'remove'))
		)
			o.remove = removeIfPresent;
	}
}

const callServiceList = rpc.declare({
	object: 'service',
	method: 'list',
	params: ['name'],
	expect: { '': {} }
});

function getServiceStatus() {
	return L.resolveDefault(callServiceList('frps'), {}).then(function (res) {
		const instances = res.frps && res.frps.instances;

		if (!instances)
			return false;

		for (let name in instances) {
			if (instances[name] && instances[name].running)
				return true;
		}

		return false;
	});
}

function renderStatus(isRunning) {
	const color = isRunning ? 'green' : 'red';
	const status = isRunning ? _('RUNNING') : _('NOT RUNNING');

	return String.format('<em><span style="color:%s"><strong>%s %s</strong></span></em>',
		color, _('frp Server'), status);
}

return view.extend({
	render() {
		let m, s, o;

		m = new form.Map('frps', _('frp Server'));
		guardUciDeleteNotFound(m.data, 'frps');

		s = m.section(form.NamedSection, '_status');
		s.anonymous = true;
		s.render = function (section_id) {
			L.Poll.add(function () {
				return L.resolveDefault(getServiceStatus()).then(function (res) {
					const view = document.getElementById('service_status');

					if (view)
						view.innerHTML = renderStatus(res);
				});
			});

			return E('div', { class: 'cbi-map' },
				E('fieldset', { class: 'cbi-section' }, [
					E('p', { id: 'service_status' }, _('Collecting data ...'))
				])
			);
		};

		s = m.section(form.NamedSection, 'common', 'conf');
		s.dynamic = true;

		s.tab('common', _('Common Settings'));
		s.tab('auth', _('Authentication'));
		s.tab('transport', _('Transport Settings'));
		s.tab('tls_quic', _('TLS / QUIC'));
		s.tab('web', _('Web Server'));
		s.tab('access', _('Access Control'));
		s.tab('ssh_tunnel', _('SSH Tunnel'));
		s.tab('log', _('Log Settings'));
		s.tab('init', _('Startup Settings'));

		defTabOpts(s, 'common', commonBaseConf, { optional: true });
		defTabOpts(s, 'auth', commonAuthConf, { optional: true });
		defTabOpts(s, 'transport', commonTransportConf, { optional: true });
		defTabOpts(s, 'tls_quic', commonTlsQuicConf, { optional: true });
		defTabOpts(s, 'web', commonWebConf, { optional: true });
		defTabOpts(s, 'access', commonAccessConf, { optional: true });
		defTabOpts(s, 'ssh_tunnel', commonSshTunnelConf, { optional: true });
		defTabOpts(s, 'log', commonLogConf, { optional: true });

		o = s.taboption('init', form.SectionValue, 'init', form.TypedSection, 'init', _('Startup Settings'));
		s = o.subsection;
		s.anonymous = true;
		s.dynamic = true;

		defOpts(s, startupConf);

		s = m.section(form.GridSection, 'http_plugin', _('HTTP Plugin Settings'));
		s.anonymous = true;
		s.addremove = true;
		s.sortable = true;
		s.nodescriptions = true;
		s.addbtntitle = _('Add new HTTP plugin...');

		defOpts(s, httpPluginConf, { optional: true });

		return m.render();
	}
});
