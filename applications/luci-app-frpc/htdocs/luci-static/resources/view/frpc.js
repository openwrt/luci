'use strict';
'require view';
'require form';
'require rpc';
'require tools.widgets as widgets';

/*
 * Important:
 *
 * This LuCI page writes UCI options into /etc/config/frpc.
 * UCI option names must not contain ".".
 *
 * Therefore we keep UCI-safe option names here, then let init/generator script
 * convert them to frp TOML keys, for example:
 *
 *   server_addr          -> serverAddr
 *   server_port          -> serverPort
 *   protocol             -> transport.protocol
 *   wire_protocol        -> transport.wireProtocol
 *   tls_enable           -> transport.tls.enable
 *   token                -> auth.token
 *   admin_addr           -> webServer.addr
 *   use_encryption       -> transport.useEncryption
 *   use_compression      -> transport.useCompression
 *   sk                   -> secretKey
 *
 * Do NOT use option names like "transport.protocol" in LuCI form options.
 */

/*
 * Debug-only TOML mapping. Keep these TOML: hints in the JS source for
 * troubleshooting generated configs, but do not show them in LuCI form text
 * and do not wrap them in _().
 *
 * common.client_id -> TOML: clientID
 * common.user -> TOML: user
 * common.server_addr -> TOML: serverAddr
 * common.server_port -> TOML: serverPort
 * common.nat_hole_stun_server -> TOML: natHoleStunServer
 * common.login_fail_exit -> TOML: loginFailExit
 * common.dns_server -> TOML: dnsServer
 * common.start -> TOML: start
 * common.udp_packet_size -> TOML: udpPacketSize
 * common.includes -> TOML: includes
 * common.authentication_method -> TOML: auth.method
 * common.token -> TOML: auth.token
 * common.auth_additional_scopes -> TOML: auth.additionalScopes
 * common.token_source_type -> TOML: auth.tokenSource.type
 * common.token_source_file_path -> TOML: auth.tokenSource.file.path
 * common.token_source_exec_command -> TOML: auth.tokenSource.exec.command
 * common.token_source_exec_args -> TOML: auth.tokenSource.exec.args
 * common.token_source_exec_env -> TOML: auth.tokenSource.exec.env
 * common.oidc_client_id -> TOML: auth.oidc.clientID
 * common.oidc_client_secret -> TOML: auth.oidc.clientSecret
 * common.oidc_audience -> TOML: auth.oidc.audience
 * common.oidc_scope -> TOML: auth.oidc.scope
 * common.oidc_token_endpoint_url -> TOML: auth.oidc.tokenEndpointURL
 * common.oidc_additional_endpoint_params -> TOML: auth.oidc.additionalEndpointParams
 * common.oidc_trusted_ca_file -> TOML: auth.oidc.trustedCaFile
 * common.oidc_insecure_skip_verify -> TOML: auth.oidc.insecureSkipVerify
 * common.oidc_proxy_url -> TOML: auth.oidc.proxyURL
 * common.dial_server_timeout -> TOML: transport.dialServerTimeout
 * common.dial_server_keepalive -> TOML: transport.dialServerKeepalive
 * common.http_proxy -> TOML: transport.proxyURL
 * common.pool_count -> TOML: transport.poolCount
 * common.tcp_mux -> TOML: transport.tcpMux
 * common.tcp_mux_keepalive_interval -> TOML: transport.tcpMuxKeepaliveInterval
 * common.protocol -> TOML: transport.protocol
 * common.wire_protocol -> TOML: transport.wireProtocol
 * common.connect_server_local_ip -> TOML: transport.connectServerLocalIP
 * common.heartbeat_interval -> TOML: transport.heartbeatInterval
 * common.heartbeat_timeout -> TOML: transport.heartbeatTimeout
 * common.tls_enable -> TOML: transport.tls.enable
 * common.tls_cert_file -> TOML: transport.tls.certFile
 * common.tls_key_file -> TOML: transport.tls.keyFile
 * common.tls_trusted_ca_file -> TOML: transport.tls.trustedCaFile
 * common.tls_server_name -> TOML: transport.tls.serverName
 * common.disable_custom_tls_first_byte -> TOML: transport.tls.disableCustomTLSFirstByte
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
 * common.feature_gates -> TOML: featureGates
 * common.virtual_net_address -> TOML: virtualNet.address
 * common.store_path -> TOML: store.path
 * common.metadatas -> TOML: metadatas
 * common.log_file -> TOML: log.to
 * common.log_level -> TOML: log.level
 * common.log_max_days -> TOML: log.maxDays
 * common.disable_log_color -> TOML: log.disablePrintColor
 * conf.name -> TOML: proxies[].name / visitors[].name
 * conf.type -> TOML: proxies[].type / visitors[].type
 * conf.enabled -> TOML: proxies[].enabled / visitors[].enabled
 * conf.local_ip -> TOML: proxies[].localIP
 * conf.local_port -> TOML: proxies[].localPort
 * conf.remote_port -> TOML: proxies[].remotePort
 * conf.custom_domains -> TOML: proxies[].customDomains
 * conf.subdomain -> TOML: proxies[].subdomain
 * conf.locations -> TOML: proxies[].locations
 * conf.http_user -> TOML: proxies[].httpUser
 * conf.http_pwd -> TOML: proxies[].httpPassword
 * conf.route_by_http_user -> TOML: proxies[].routeByHTTPUser
 * conf.host_header_rewrite -> TOML: proxies[].hostHeaderRewrite
 * conf.request_headers -> TOML: proxies[].requestHeaders.set
 * conf.response_headers -> TOML: proxies[].responseHeaders.set
 * conf.multiplexer -> TOML: proxies[].multiplexer
 * conf.group -> TOML: proxies[].loadBalancer.group
 * conf.group_key -> TOML: proxies[].loadBalancer.groupKey
 * conf.health_check_type -> TOML: proxies[].healthCheck.type
 * conf.health_check_url -> TOML: proxies[].healthCheck.path
 * conf.health_check_headers -> TOML: proxies[].healthCheck.httpHeaders
 * conf.sk -> TOML: proxies[].secretKey / visitors[].secretKey
 * conf.allow_users -> TOML: proxies[].allowUsers
 * conf.server_user -> TOML: visitors[].serverUser
 * conf.server_name -> TOML: visitors[].serverName
 * conf.bind_addr -> TOML: visitors[].bindAddr
 * conf.bind_port -> TOML: visitors[].bindPort
 * conf.visitor_protocol -> TOML: visitors[].protocol
 * conf.keep_tunnel_open -> TOML: visitors[].keepTunnelOpen
 * conf.fallback_to -> TOML: visitors[].fallbackTo
 * conf.plugin -> TOML: proxies[].plugin.type / visitors[].plugin.type
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
	_('Extra root-level configuration fragments included before generated proxy and visitor sections. Use frp includes or per-proxy raw settings for proxy/visitor tables.'),
	{
		datatype: 'file',
		placeholder: '/etc/frp/frpc.d/frpc_extra.toml'
	}]
];

const commonBaseConf = [
	[form.Value, 'client_id', _('Client ID'),
	_('Optional unique identifier for this frpc instance.')],

	[form.Value, 'server_addr', _('Server address'),
	_('Address of the frps server.'),
	{ datatype: 'host', rmempty: false, placeholder: '127.0.0.1' }],

	[form.Value, 'server_port', _('Server port'),
	_('Port of the frps server. Default is 7000.'),
	{ datatype: 'port', rmempty: false, placeholder: '7000' }],

	[form.Value, 'user', _('Proxy name prefix'),
	_('Prefix for proxy names. If set, proxy names become {user}.{proxy}.')],

	[form.Value, 'nat_hole_stun_server', _('NAT hole STUN server'),
	_('STUN server used for NAT traversal.'),
	{ placeholder: 'stun.easyvoip.com:3478' }],

	[form.Flag, 'login_fail_exit', _('Exit when login fails'),
	_('Exit frpc when the first login fails.'),
	{
		enabled: 'true',
		disabled: 'false',
		default: 'true',
		optional: false,
		rmempty: false,
		retain: true,
		remove: writeFlagDisabled
	}],

	[form.Value, 'dns_server', _('DNS server'),
	_('Custom DNS server used by frpc.'),
	{ datatype: 'ipaddr', placeholder: '8.8.8.8' }],

	[form.DynamicList, 'start', _('Start proxies / visitors'),
	_('Only start specified proxies or visitors. Empty means start all.'),
	{ placeholder: 'ssh' }],

	[form.Value, 'udp_packet_size', _('UDP packet size'),
	_('UDP packet size in bytes. Should match frps. Default is 1500.'),
	{ datatype: 'uinteger', placeholder: '1500' }],

	[form.DynamicList, 'includes', _('Include config files'),
	_('Additional config files included by frpc.'),
	{ placeholder: './confd/*.toml' }]
];

const commonAuthConf = [
	[form.ListValue, 'authentication_method', _('Authentication method'),
	_('Authentication method.'),
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

	[form.Value, 'oidc_client_id', _('OIDC client ID'),
	_('Configuration key: auth.oidc.clientID.'),
	{ depends: { authentication_method: 'oidc' } }],

	[form.Value, 'oidc_client_secret', _('OIDC client secret'),
	_('Configuration key: auth.oidc.clientSecret.'),
	{ depends: { authentication_method: 'oidc' }, password: true }],

	[form.Value, 'oidc_audience', _('OIDC audience'),
	_('Configuration key: auth.oidc.audience.'),
	{ depends: { authentication_method: 'oidc' } }],

	[form.Value, 'oidc_scope', _('OIDC scope'),
	_('Configuration key: auth.oidc.scope.'),
	{ depends: { authentication_method: 'oidc' } }],

	[form.Value, 'oidc_token_endpoint_url', _('OIDC token endpoint URL'),
	_('Configuration key: auth.oidc.tokenEndpointURL.'),
	{ depends: { authentication_method: 'oidc' }, datatype: 'url' }],

	[form.DynamicList, 'oidc_additional_endpoint_params', _('OIDC additional endpoint params'),
	_('Additional OIDC token endpoint params. Use key=value.'),
	{
		depends: { authentication_method: 'oidc' },
		placeholder: 'audience=https://dev.auth.com/api/v2/',
		validate: function (section_id, value) {
			return validateKeyValue(value);
		}
	}],

	[form.Value, 'oidc_trusted_ca_file', _('OIDC trusted CA file'),
	_('Custom CA certificate file for OIDC endpoint.'),
	{ depends: { authentication_method: 'oidc' }, datatype: 'file' }],

	[form.Flag, 'oidc_insecure_skip_verify', _('OIDC insecure skip verify'),
	_('Skip TLS verification for OIDC endpoint. Not recommended for production.'),
	{ depends: { authentication_method: 'oidc' }, datatype: 'bool', default: 'false' }],

	[form.Value, 'oidc_proxy_url', _('OIDC proxy URL'),
	_('Proxy URL for OIDC token endpoint.'),
	{ depends: { authentication_method: 'oidc' }, datatype: 'url', placeholder: 'http://proxy.example.com:8080' }]
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
	{ validate: validatePortOrZero, placeholder: '7400' }],

	[form.Value, 'admin_user', _('Web server user'),
	_('Web server username.'),
	{ placeholder: 'admin' }],

	[form.Value, 'admin_pwd', _('Web server password'),
	_('Web server password.'),
	{ password: true, placeholder: 'change_me_to_a_strong_password' }],

	[form.Flag, 'admin_tls_enable', _('Enable web HTTPS'),
	_('Enable HTTPS for the frpc web server. This switch controls whether webServer.tls.certFile and webServer.tls.keyFile are emitted.'),
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
		placeholder: '/etc/ssl/acme/example.com.fullchain.crt',
		retain: true,
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
		placeholder: '/etc/ssl/acme/example.com.key',
		retain: true,
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
	_('Enable Go pprof handlers in web server.'),
	{
		datatype: 'bool',
		enabled: 'true',
		disabled: 'false',
		default: 'false',
		rmempty: false,
		retain: true,
		remove: writeFlagDisabled
	}]
];

const commonTransportConf = [
	[form.Value, 'dial_server_timeout', _('Dial server timeout'),
	_('Timeout in seconds for connecting to frps.'),
	{ datatype: 'uinteger', placeholder: '10' }],

	[form.Value, 'dial_server_keepalive', _('Dial server keepalive'),
	_('TCP keepalive interval in seconds. Negative value disables keepalive.'),
	{ datatype: 'integer', placeholder: '7200' }],

	[form.Value, 'http_proxy', _('Proxy URL'),
	_('Proxy URL used to connect to frps. Supports http, socks5 and ntlm.'),
	{ placeholder: 'http://user:passwd@192.168.1.128:8080' }],

	[form.Value, 'pool_count', _('Connection pool count'),
	_('Connections established in advance.'),
	{ datatype: 'uinteger', placeholder: '1' }],

	[form.Flag, 'tcp_mux', _('TCP mux'),
	_('Enable TCP stream multiplexing.'),
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

	[form.ListValue, 'protocol', _('Transport protocol'),
	_('Transport protocol used to connect to frps.'),
	{ values: ['tcp', 'kcp', 'quic', 'websocket', 'wss'], default: 'tcp' }],

	[form.ListValue, 'wire_protocol', _('Wire protocol'),
	_('frp internal wire protocol. v2 requires frps support and must be enabled explicitly.'),
	{ values: ['v1', 'v2'], default: 'v1' }],

	[form.Value, 'connect_server_local_ip', _('Connect server local IP'),
	_('Local IP bound when connecting to frps. Only valid for tcp, websocket or wss.'),
	{
		datatype: 'ipaddr',
		depends: [{ protocol: 'tcp' }, { protocol: 'websocket' }, { protocol: 'wss' }],
		placeholder: '0.0.0.0'
	}],

	[form.Value, 'heartbeat_interval', _('Heartbeat interval'),
	_('Heartbeat interval in seconds.'),
	{ datatype: 'integer', placeholder: '30' }],

	[form.Value, 'heartbeat_timeout', _('Heartbeat timeout'),
	_('Heartbeat timeout in seconds.'),
	{ datatype: 'integer', placeholder: '90' }]
];

const commonTlsQuicConf = [
	[form.Flag, 'tls_enable', _('TLS'),
	_('Enable TLS when communicating with frps. Since frp v0.50.0, default is true.'),
	{
		enabled: 'true',
		disabled: 'false',
		default: 'true',
		optional: false,
		rmempty: false,
		retain: true,
		remove: writeFlagDisabled
	}],

	[form.Value, 'tls_cert_file', _('TLS certificate path'),
	_('Path to the TLS certificate file.'),
	{ datatype: 'file', placeholder: '/etc/ssl/frp/client.crt' }],

	[form.Value, 'tls_key_file', _('TLS private key path'),
	_('Path to the TLS private key file.'),
	{ datatype: 'file', placeholder: '/etc/ssl/frp/client.key' }],

	[form.Value, 'tls_trusted_ca_file', _('TLS trusted CA path'),
	_('Path to the trusted CA certificate file.'),
	{ datatype: 'file', placeholder: '/etc/ssl/frp/ca.crt' }],

	[form.Value, 'tls_server_name', _('TLS server name'),
	_('Server name used for TLS verification.'),
	{ placeholder: 'example.com' }],

	[form.Flag, 'disable_custom_tls_first_byte', _('Disable custom TLS first byte'),
	_('Since frp v0.50.0, default is true.'),
	{
		enabled: 'true',
		disabled: 'false',
		default: 'true',
		optional: false,
		rmempty: false,
		retain: true,
		remove: writeFlagDisabled
	}],

	[form.Value, 'quic_keepalive_period', _('QUIC keepalive period'),
	_('Configuration key: transport.quic.keepalivePeriod.'),
	{ datatype: 'uinteger', depends: { protocol: 'quic' }, placeholder: '10' }],

	[form.Value, 'quic_max_idle_timeout', _('QUIC max idle timeout'),
	_('Configuration key: transport.quic.maxIdleTimeout.'),
	{ datatype: 'uinteger', depends: { protocol: 'quic' }, placeholder: '30' }],

	[form.Value, 'quic_max_incoming_streams', _('QUIC max incoming streams'),
	_('Configuration key: transport.quic.maxIncomingStreams.'),
	{ datatype: 'uinteger', depends: { protocol: 'quic' }, placeholder: '100000' }]
];

const commonAdvancedConf = [
	[form.DynamicList, 'feature_gates', _('Feature gates'),
	_('Experimental feature gates. Use key=value, for example VirtualNet=true.'),
	{
		placeholder: 'VirtualNet=true',
		validate: function (section_id, value) {
			return validateKeyValue(value);
		}
	}],

	[form.Value, 'virtual_net_address', _('VirtualNet address'),
	_('Virtual network address. Requires VirtualNet feature gate.'),
	{ placeholder: '100.86.1.1/24' }],

	[form.Value, 'store_path', _('Store file path'),
	_('Persist runtime proxy and visitor configuration for Web UI or API management.'),
	{ datatype: 'file', placeholder: '/etc/frp/frpc_store.json' }],

	[form.DynamicList, 'metadatas', _('Client metadata'),
	_('Additional client metadata. Use key=value.'),
	{
		placeholder: 'var1=abc',
		validate: function (section_id, value) {
			return validateKeyValue(value);
		}
	}]
];

const proxyOnlyDepends = [
	{ type: 'tcp' },
	{ type: 'udp' },
	{ type: 'http' },
	{ type: 'https' },
	{ type: 'tcpmux' },
	{ type: 'stcp', role: 'server' },
	{ type: 'xtcp', role: 'server' },
	{ type: 'sudp', role: 'server' }
];

const healthCheckDepends = [
	{ type: 'tcp' },
	{ type: 'http' },
	{ type: 'https' },
	{ type: 'tcpmux' }
];

const baseProxyConf = [
	[form.Value, 'name', _('Proxy name'), undefined,
	{ rmempty: false, optional: false }],

	[form.ListValue, 'type', _('Proxy type'),
	_('Proxy type.'),
	{ values: ['tcp', 'udp', 'http', 'https', 'stcp', 'xtcp', 'sudp', 'tcpmux'], default: 'tcp' }],

	[form.Flag, 'enabled', _('Enabled'),
	_('Enable or disable this proxy.'),
	{
		enabled: 'true',
		disabled: 'false',
		default: 'true',
		optional: false,
		rmempty: false,
		retain: true,
		remove: writeFlagDisabled
	}],

	[form.Value, 'local_ip', _('Local IP'),
	_('Local service IP or host.'),
	{ datatype: 'host', depends: proxyOnlyDepends }],

	[form.Value, 'local_port', _('Local port'),
	_('Local service port.'),
	{ datatype: 'port', depends: proxyOnlyDepends }],

	[form.Value, 'remote_port', _('Remote port'),
	_('Remote port listened by frps. If 0, frps assigns a random port.'),
	{
		validate: validatePortOrZero,
		depends: [{ type: 'tcp' }, { type: 'udp' }],
		textvalue: function (section_id) {
			const v = this.cfgvalue(section_id);
			return v && v !== '0' ? v : '#';
		}
	}]
];

const proxyTransportConf = [
	[form.Value, 'bandwidth_limit', _('Bandwidth limit'),
	_('Bandwidth limit, for example 1MB.'),
	{ placeholder: '1MB', depends: proxyOnlyDepends }],

	[form.ListValue, 'bandwidth_limit_mode', _('Bandwidth limit mode'),
	_('Where to limit bandwidth.'),
	{ values: ['client', 'server'], default: 'client', depends: proxyOnlyDepends }],

	[form.Flag, 'use_encryption', _('Encryption'),
	_('Encrypt proxy traffic.'),
	{ datatype: 'bool', default: 'false' }],

	[form.Flag, 'use_compression', _('Compression'),
	_('Compress proxy traffic.'),
	{ datatype: 'bool', default: 'false' }],

	[form.ListValue, 'proxy_protocol_version', _('Proxy protocol version'),
	_('Use proxy protocol to transfer connection info to local service.'),
	{ values: [['', _('Disabled')], ['v1', 'v1'], ['v2', 'v2']], rmempty: true, depends: proxyOnlyDepends }]
];

const domainConf = [
	[form.DynamicList, 'custom_domains', _('Custom domains'),
	_('Configuration key: proxies[].customDomains.'),
	{ placeholder: 'web01.yourdomain.com' }],

	[form.Value, 'subdomain', _('Subdomain'),
	_('Configuration key: proxies[].subdomain.')]
];

const httpProxyConf = [
	[form.DynamicList, 'locations', _('Locations'),
	_('Only valid for HTTP proxy.'),
	{
		placeholder: '/',
		validate: function (section_id, value) {
			return validateHttpPath(value);
		}
	}],

	[form.Value, 'host_header_rewrite', _('Host header rewrite'),
	_('Rewrite Host header.')],

	[form.DynamicList, 'request_headers', _('Request headers'),
	_('Set request headers. Use Header=Value.'),
	{
		placeholder: 'x-from-where=frp',
		validate: function (section_id, value) {
			return validateKeyValue(value);
		}
	}],

	[form.DynamicList, 'response_headers', _('Response headers'),
	_('Set response headers. Use Header=Value.'),
	{
		placeholder: 'foo=bar',
		validate: function (section_id, value) {
			return validateKeyValue(value);
		}
	}]
];

const httpAuthConf = [
	[form.Value, 'http_user', _('HTTP user'),
	_('HTTP or TCPMUX basic auth username.')],

	[form.Value, 'http_pwd', _('HTTP password'),
	_('HTTP or TCPMUX basic auth password.'),
	{ password: true }]
];

const routeByHTTPUserConf = [
	[form.Value, 'route_by_http_user', _('Route by HTTP user'),
	_('Route HTTP or TCPMUX requests by HTTP basic auth user.')]
];

const tcpmuxConf = [
	[form.ListValue, 'multiplexer', _('Multiplexer'),
	_('TCP multiplexer.'),
	{ values: ['httpconnect'], depends: { type: 'tcpmux' }, default: 'httpconnect' }]
];

const loadBalancerConf = [
	[form.Value, 'group', _('Load balancer group'),
	_('Configuration key: proxies[].loadBalancer.group.'),
	{ depends: proxyOnlyDepends }],

	[form.Value, 'group_key', _('Load balancer group key'),
	_('Configuration key: proxies[].loadBalancer.groupKey.'),
	{
		password: true,
		depends: proxyOnlyDepends,
		validate: function (section_id, value) {
			const group = this.section.getOption('group');

			if (String(value || '').trim() && group && !String(group.formvalue(section_id) || '').trim())
				return _('Load balancer group is required when group key is set.');

			return true;
		}
	}]
];

const healthCheckConf = [
	[form.ListValue, 'health_check_type', _('Health check type'),
	_('Health check type.'),
	{ values: [['', _('Disabled')], ['tcp', 'tcp'], ['http', 'http']], rmempty: true, depends: healthCheckDepends }],

	[form.Value, 'health_check_timeout_s', _('Health check timeout'),
	_('Health check timeout in seconds.'),
	{ datatype: 'uinteger', depends: [{ health_check_type: 'tcp' }, { health_check_type: 'http' }], placeholder: '3' }],

	[form.Value, 'health_check_max_failed', _('Health check max failed'),
	_('Remove proxy from frps after continuous failures.'),
	{ datatype: 'uinteger', depends: [{ health_check_type: 'tcp' }, { health_check_type: 'http' }], placeholder: '3' }],

	[form.Value, 'health_check_interval_s', _('Health check interval'),
	_('Health check interval in seconds.'),
	{ datatype: 'uinteger', depends: [{ health_check_type: 'tcp' }, { health_check_type: 'http' }], placeholder: '10' }],

	[form.Value, 'health_check_url', _('Health check path'),
	_('HTTP health check path.'),
	{
		depends: { health_check_type: 'http' },
		placeholder: '/status',
		validate: function (section_id, value) {
			const healthCheckType = this.section.getOption('health_check_type');

			if (
				healthCheckType &&
				healthCheckType.formvalue(section_id) === 'http' &&
				!String(value || '').trim()
			)
				return _('Health check path is required when health check type is http.');

			return validateHttpPath(value);
		}
	}],

	[form.DynamicList, 'health_check_headers', _('Health check headers'),
	_('HTTP health check headers. Use Header=Value.'),
	{
		depends: { health_check_type: 'http' },
		placeholder: 'x-from-where=frp',
		validate: function (section_id, value) {
			return validateKeyValue(value);
		}
	}]
];

const stcpXtcpConf = [
	[form.ListValue, 'role', _('Role'),
	_('Compatibility field for UCI. Server sections are emitted as proxy entries; visitor sections are emitted as visitor entries.'),
	{ values: ['server', 'visitor'], default: 'server' }],

	[form.Value, 'sk', _('Secret key'),
	_('Secret key used by STCP/XTCP/SUDP proxies and visitors.'),
	{ password: true }],

	[form.DynamicList, 'allow_users', _('Allow users'),
	_('Only visitors from specified users can connect. Use * to allow all users.'),
	{ depends: { role: 'server' }, placeholder: '*' }],

	[form.Value, 'server_user', _('Server user'),
	_('Server user for visitor.'),
	{ depends: { role: 'visitor' } }],

	[form.Value, 'server_name', _('Server name'),
	_('Server proxy name to visit.'),
	{
		depends: { role: 'visitor' },
		validate: function (section_id, value) {
			const role = this.section.getOption('role');

			if (role && role.formvalue(section_id) === 'visitor' && !String(value || '').trim())
				return _('Server name is required for visitors.');

			return true;
		}
	}],

	[form.Value, 'bind_addr', _('Bind address'),
	_('Local bind address for visitor.'),
	{ depends: { role: 'visitor' }, datatype: 'ipaddr', placeholder: '127.0.0.1' }],

	[form.Value, 'bind_port', _('Bind port'),
	_('Local bind port for visitor. Use a negative value to avoid binding.'),
	{
		depends: { role: 'visitor' },
		validate: function (section_id, value) {
			const role = this.section.getOption('role');

			if (role && role.formvalue(section_id) === 'visitor' && !String(value || '').trim())
				return _('Bind port is required for visitors.');

			return validateVisitorBindPort(section_id, value);
		}
	}],

	[form.ListValue, 'visitor_protocol', _('XTCP protocol'),
	_('XTCP visitor tunnel protocol.'),
	{ depends: { role: 'visitor', type: 'xtcp' }, values: ['quic', 'kcp'], default: 'quic' }],

	[form.Flag, 'keep_tunnel_open', _('Keep tunnel open'),
	_('Keep XTCP tunnel open.'),
	{ depends: { role: 'visitor', type: 'xtcp' }, datatype: 'bool', default: 'false' }],

	[form.Value, 'max_retries_an_hour', _('Max retries per hour'),
	_('Effective when XTCP keep tunnel open is enabled.'),
	{ depends: { role: 'visitor', type: 'xtcp' }, datatype: 'uinteger', placeholder: '8' }],

	[form.Value, 'min_retry_interval', _('Min retry interval'),
	_('Minimum XTCP retry interval.'),
	{ depends: { role: 'visitor', type: 'xtcp' }, datatype: 'uinteger', placeholder: '90' }],

	[form.Value, 'fallback_to', _('Fallback to'),
	_('Fallback visitor name for XTCP.'),
	{ depends: { role: 'visitor', type: 'xtcp' } }],

	[form.Value, 'fallback_timeout_ms', _('Fallback timeout ms'),
	_('Fallback timeout in milliseconds for XTCP.'),
	{ depends: { role: 'visitor', type: 'xtcp' }, datatype: 'uinteger', placeholder: '500' }],

	[form.Flag, 'nat_disable_assisted_addrs', _('Disable NAT assisted addresses'),
	_('Disable local interface assisted addresses for XTCP NAT traversal.'),
	{ depends: { type: 'xtcp' }, datatype: 'bool', default: 'false' }]
];

const pluginConf = [
	[form.ListValue, 'plugin', _('Plugin'),
	_('Plugin type.'),
	{
		values: [
			['', _('Disabled')],
			['http_proxy', 'http_proxy'],
			['socks5', 'socks5'],
			['unix_domain_socket', 'unix_domain_socket'],
			['static_file', 'static_file'],
			['https2http', 'https2http'],
			['https2https', 'https2https'],
			['http2https', 'http2https'],
			['http2http', 'http2http'],
			['tls2raw', 'tls2raw'],
			['virtual_net', 'virtual_net']
		],
		rmempty: true,
		validate: function (section_id, value) {
			return validatePlugin(this.section, section_id, value);
		}
	}],

	[form.Value, 'plugin_http_user', _('HTTP user'),
	_('Configuration key: plugin.httpUser.'),
	{ depends: [{ plugin: 'http_proxy' }, { plugin: 'static_file' }] }],

	[form.Value, 'plugin_http_passwd', _('HTTP password'),
	_('Configuration key: plugin.httpPassword.'),
	{ depends: [{ plugin: 'http_proxy' }, { plugin: 'static_file' }], password: true }],

	[form.Value, 'plugin_user', _('SOCKS5 user'),
	_('Configuration key: plugin.username.'),
	{ depends: { plugin: 'socks5' } }],

	[form.Value, 'plugin_passwd', _('SOCKS5 password'),
	_('Configuration key: plugin.password.'),
	{ depends: { plugin: 'socks5' }, password: true }],

	[form.Value, 'plugin_unix_path', _('Unix domain socket path'),
	_('Configuration key: plugin.unixPath.'),
	{
		depends: { plugin: 'unix_domain_socket' },
		optional: false,
		rmempty: false,
		datatype: 'file',
		placeholder: '/var/run/docker.sock',
		default: '/var/run/docker.sock'
	}],

	[form.Value, 'plugin_local_path', _('Static file local path'),
	_('Configuration key: plugin.localPath.'),
	{ depends: { plugin: 'static_file' }, datatype: 'directory', placeholder: '/var/www/blog' }],

	[form.Value, 'plugin_strip_prefix', _('Static file strip prefix'),
	_('Configuration key: plugin.stripPrefix.'),
	{ depends: { plugin: 'static_file' }, placeholder: 'static' }],

	[form.Value, 'plugin_local_addr', _('Plugin local address'),
	_('Local backend address used by bridge plugins. For https2http, https2https and tls2raw, this is the local service address reached after frp terminates external TLS; for http2https/http2http, it is the local upstream address.'),
	{
		depends: [
			{ plugin: 'https2http' },
			{ plugin: 'https2https' },
			{ plugin: 'http2https' },
			{ plugin: 'http2http' },
			{ plugin: 'tls2raw' }
		],
		placeholder: '127.0.0.1:80'
	}],

	[form.Value, 'plugin_crt_path', _('Plugin certificate path'),
	_('Configuration key: plugin.crtPath.'),
	{
		depends: [
			{ plugin: 'https2http' },
			{ plugin: 'https2https' },
			{ plugin: 'tls2raw' }
		],
		datatype: 'file',
		placeholder: './server.crt'
	}],

	[form.Value, 'plugin_key_path', _('Plugin key path'),
	_('Configuration key: plugin.keyPath.'),
	{
		depends: [
			{ plugin: 'https2http' },
			{ plugin: 'https2https' },
			{ plugin: 'tls2raw' }
		],
		datatype: 'file',
		placeholder: './server.key'
	}],

	[form.Value, 'plugin_host_header_rewrite', _('Plugin host header rewrite'),
	_('Configuration key: plugin.hostHeaderRewrite.'),
	{
		depends: [
			{ plugin: 'https2http' },
			{ plugin: 'https2https' },
			{ plugin: 'http2https' },
			{ plugin: 'http2http' }
		],
		placeholder: '127.0.0.1'
	}],

	[form.Flag, 'plugin_enable_http2', _('Plugin HTTP/2'),
	_('Enable HTTP/2 for HTTPS bridge plugins.'),
	{
		depends: [
			{ plugin: 'https2http' },
			{ plugin: 'https2https' }
		],
		enabled: 'true',
		disabled: 'false',
		default: 'true',
		optional: false,
		rmempty: false,
		retain: true,
		remove: writeFlagDisabled
	}],

	[form.DynamicList, 'plugin_request_headers', _('Plugin request headers'),
	_('Use Header=Value.'),
	{
		depends: [
			{ plugin: 'https2http' },
			{ plugin: 'https2https' },
			{ plugin: 'http2https' },
			{ plugin: 'http2http' }
		],
		placeholder: 'x-from-where=frp',
		validate: function (section_id, value) {
			return validateKeyValue(value);
		}
	}],

	[form.Value, 'plugin_destination_ip', _('VirtualNet destination IP'),
	_('For virtual_net visitor plugin.'),
	{
		depends: { plugin: 'virtual_net', role: 'visitor' },
		datatype: 'ipaddr',
		placeholder: '100.86.0.1',
		validate: function (section_id, value) {
			return validateVirtualNetDestination(this.section, section_id, value);
		}
	}]
];

const metadataConf = [
	[form.DynamicList, 'metadatas', _('Proxy metadatas'),
	_('Additional proxy metadata. Use key=value.'),
	{
		depends: proxyOnlyDepends,
		placeholder: 'var1=abc',
		validate: function (section_id, value) {
			return validateKeyValue(value);
		}
	}],

	[form.DynamicList, 'annotations', _('Annotations'),
	_('Annotations displayed on frps dashboard. Use key=value.'),
	{
		depends: proxyOnlyDepends,
		placeholder: 'key1=value1',
		validate: function (section_id, value) {
			return validateKeyValue(value);
		}
	}]
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

function validateVisitorBindPort(section_id, value) {
	if (!value)
		return true;

	value = String(value).trim();

	if (/^-\d+$/.test(value) && Number(value) < 0)
		return true;

	if (!/^\d+$/.test(value))
		return _('Port must be negative or a number between 1 and 65535.');

	const port = Number(value);
	if (port < 1 || port > 65535)
		return _('Port must be negative or between 1 and 65535.');

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
		return _('HTTP path must start with /.');

	return true;
}

function validateKeyValue(value) {
	if (!value)
		return true;

	if (/[\r\n]/.test(String(value)) || !/^[^=\s][^=]*=.*$/.test(String(value)))
		return _('Please use KEY=value format.');

	return true;
}

function validatePlugin(section, section_id, value) {
	const role = section.getOption('role');
	const roleValue = role ? role.formvalue(section_id) : null;

	if (roleValue === 'visitor' && value && value !== 'virtual_net')
		return _('Only the virtual_net plugin is valid for visitors.');

	return true;
}

function validateVirtualNetDestination(section, section_id, value) {
	const plugin = section.getOption('plugin');
	const role = section.getOption('role');

	if (
		plugin && plugin.formvalue(section_id) === 'virtual_net' &&
		role && role.formvalue(section_id) === 'visitor' &&
		!String(value || '').trim()
	)
		return _('VirtualNet destination IP is required for virtual_net visitors.');

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
	return L.resolveDefault(callServiceList('frpc'), {}).then(function (res) {
		const instances = res.frpc && res.frpc.instances;

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
		color, _('frp Client'), status);
}

return view.extend({
	render() {
		let m, s, o;

		m = new form.Map('frpc', _('frp Client'));
		guardUciDeleteNotFound(m.data, 'frpc');

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
		s.tab('advanced', _('Advanced'));
		s.tab('log', _('Log Settings'));
		s.tab('init', _('Startup Settings'));

		defTabOpts(s, 'common', commonBaseConf, { optional: true });
		defTabOpts(s, 'auth', commonAuthConf, { optional: true });
		defTabOpts(s, 'transport', commonTransportConf, { optional: true });
		defTabOpts(s, 'tls_quic', commonTlsQuicConf, { optional: true });
		defTabOpts(s, 'web', commonWebConf, { optional: true });
		defTabOpts(s, 'advanced', commonAdvancedConf, { optional: true });
		defTabOpts(s, 'log', commonLogConf, { optional: true });

		o = s.taboption('init', form.SectionValue, 'init', form.TypedSection, 'init', _('Startup Settings'));
		s = o.subsection;
		s.anonymous = true;
		s.dynamic = true;

		defOpts(s, startupConf);

		s = m.section(form.GridSection, 'conf', _('Proxy / Visitor Settings'));
		s.anonymous = true;
		s.addremove = true;
		s.sortable = true;
		s.nodescriptions = true;
		s.addbtntitle = _('Add new proxy or visitor...');

		s.filter = function (section_id) {
			return section_id !== 'common';
		};

		s.tab('general', _('General Settings'));
		s.tab('transport', _('Transport'));
		s.tab('http', _('HTTP / Domain'));
		s.tab('plugin', _('Plugin'));
		s.tab('stcp_xtcp', _('STCP / XTCP / SUDP'));
		s.tab('health', _('Health Check'));
		s.tab('lb', _('Load Balancer'));
		s.tab('metadata', _('Metadata'));

		defTabOpts(s, 'general', baseProxyConf, { modalonly: null });
		defTabOpts(s, 'transport', proxyTransportConf, { optional: true, modalonly: true });

		defTabOpts(s, 'http', domainConf, {
			optional: true,
			modalonly: true,
			depends: [{ type: 'http' }, { type: 'https' }, { type: 'tcpmux' }]
		});

		defTabOpts(s, 'http', httpProxyConf, {
			optional: true,
			modalonly: true,
			depends: { type: 'http' }
		});

		defTabOpts(s, 'http', httpAuthConf, {
			optional: true,
			modalonly: true,
			depends: [{ type: 'http' }, { type: 'tcpmux' }]
		});

		defTabOpts(s, 'http', routeByHTTPUserConf, {
			optional: true,
			modalonly: true,
			depends: [{ type: 'http' }, { type: 'tcpmux' }]
		});

		defTabOpts(s, 'http', tcpmuxConf, {
			optional: true,
			modalonly: true,
			depends: { type: 'tcpmux' }
		});

		defTabOpts(s, 'plugin', pluginConf, {
			optional: true,
			modalonly: true
		});

		defTabOpts(s, 'stcp_xtcp', stcpXtcpConf, {
			optional: true,
			modalonly: true,
			depends: [{ type: 'stcp' }, { type: 'xtcp' }, { type: 'sudp' }]
		});

		defTabOpts(s, 'health', healthCheckConf, {
			optional: true,
			modalonly: true,
			depends: healthCheckDepends
		});

		defTabOpts(s, 'lb', loadBalancerConf, {
			optional: true,
			modalonly: true
		});

		defTabOpts(s, 'metadata', metadataConf, {
			optional: true,
			modalonly: true
		});

		return m.render();
	}
});
