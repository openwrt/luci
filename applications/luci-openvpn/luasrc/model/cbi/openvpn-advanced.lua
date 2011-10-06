--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--

require("luci.ip")
require("luci.model.uci")


local knownParams = {
	--
	--	Widget			Name							Default(s)	Option(s)	Description 
	--

	{ "service", {
		-- initialisation and daemon options
		{ ListValue,	"verb",							{ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11 }, translate("Set output verbosity") },
		{ Flag,			"mlock",						0, translate("Disable Paging") },
		{ Flag,			"disable_occ",					0, translate("Disable options consistency check") },
	--	{ Value,		"user",							"root", translate("Set UID to user") },
	--	{ Value,		"group",						"root", translate("Set GID to group") },
		{ Value,		"cd",							"/etc/openvpn", translate("Change to directory before initialization") },
		{ Value,		"chroot",						"/var/run", translate("Chroot to directory after initialization") },
	--	{ Value,		"daemon",						"Instance-Name", translate("Daemonize after initialization") },
	--	{ Value,		"syslog",						"Instance-Name", translate("Output to syslog and do not daemonize") },
		{ Flag,			"passtos",						0, translate("TOS passthrough (applies to IPv4 only)") },
	--	{ Value,		"inetd",						"nowait Instance-Name", translate("Run as an inetd or xinetd server") },
		{ Value,		"log",							"/var/log/openvpn.log", translate("Write log to file") },
		{ Value,		"log_append",					"/var/log/openvpn.log", translate("Append log to file") },
		{ Flag,			"suppress_timestamps",			0, translate("Don't log timestamps") },
	--	{ Value,		"writepid",						"/var/run/openvpn.pid", translate("Write process ID to file") },
		{ Value,		"nice",							0, translate("Change process priority") },
		{ Flag,			"fast_io",						0, translate("Optimize TUN/TAP/UDP writes") },
		{ Value,		"echo",							"some params echoed to log", translate("Echo parameters to log") },
		{ ListValue,	"remap_usr1",					{ "SIGHUP", "SIGTERM" }, translate("Remap SIGUSR1 signals") },
		{ Value,		"status",						"/var/run/openvpn.status 5", translate("Write status to file every n seconds") },
		{ Value,		"status_version",				{ 1, 2 }, translate("Status file format version") },	-- status
		{ Value,		"mute",							5, translate("Limit repeated log messages") },

		{ Value,		"up",							"/usr/bin/ovpn-up", translate("Shell cmd to execute after tun device open") },
		{ Value,		"up_delay",						5, translate("Delay tun/tap open and up script execution") },
		{ Value,		"down",							"/usr/bin/ovpn-down", translate("Shell cmd to run after tun device close") },
		{ Flag,			"down_pre",						0, translate("Call down cmd/script before TUN/TAP close") },
		{ Flag,			"up_restart",					0, translate("Run up/down scripts for all restarts") },
		{ Value,		"route_up",						"/usr/bin/ovpn-routeup", translate("Execute shell cmd after routes are added") },
		{ Value,		"ipchange",						"/usr/bin/ovpn-ipchange",	{ mode="p2p" }, translate("Execute shell command on remote ip change") },
		{ DynamicList,	"setenv",						{ "VAR1 value1", "VAR2 value2" }, translate("Pass environment variables to script") },
		{ Value,		"tls_verify",					"/usr/bin/ovpn-tlsverify", translate("Shell command to verify X509 name") },
		{ Value,		"client_connect",				"/usr/bin/ovpn-clientconnect", translate("Run script cmd on client connection") },
		{ Flag,			"client_disconnect",			0, translate("Run script cmd on client disconnection") },
		{ Value,		"learn_address",				"/usr/bin/ovpn-learnaddress", translate("Executed in server mode whenever an IPv4 address/route or MAC address is added to OpenVPN's internal routing table") },
		{ Value,		"auth_user_pass_verify",		"/usr/bin/ovpn-userpass via-env", translate("Executed in server mode on new client connections, when the client is still untrusted") },
		{ ListValue,	"script_security",				{ 0, 1, 2, 3 },	{mode="server" }, translate("Policy level over usage of external programs and scripts") },
	} },

	{ "networking", {
		-- socket config
		{ ListValue,	"mode",							{ "p2p", "server" }, translate("Major mode") },
		{ Value,		"local",						"0.0.0.0", translate("Local host name or ip address") },
		{ Value,		"port",							1194, translate("TCP/UDP port # for both local and remote") },
		{ Value,		"lport",						1194, translate("TCP/UDP port # for local (default=1194)") },
		{ Value,		"rport",						1194, translate("TCP/UDP port # for remote (default=1194)") },
		{ Flag,			"float",						0, translate("Allow remote to change its IP or port") },
		{ Flag,			"nobind",						0, translate("Do not bind to local address and port") },

		{ Value,		"dev",							"tun0", translate("tun/tap device") },
		{ ListValue,	"dev_type",						{ "tun", "tap" }, translate("Type of used device") },
		{ Value,		"dev_node",						"/dev/net/tun", translate("Use tun/tap device node") },
		{ Flag,			"tun_ipv6",						0, translate("Make tun device IPv6 capable") },

		{ Value,		"ifconfig",						"10.200.200.3 10.200.200.1", translate("Set tun/tap adapter parameters") },
		{ Flag,			"ifconfig_noexec",				0, translate("Don't actually execute ifconfig") },
		{ Flag,			"ifconfig_nowarn",				0, translate("Don't warn on ifconfig inconsistencies") },

		{ DynamicList,	"route",						"10.123.0.0 255.255.0.0", translate("Add route after establishing connection") },
		{ Value,		"route_gateway",				"10.234.1.1", translate("Specify a default gateway for routes") },
		{ Value,		"route_delay",					0, translate("Delay n seconds after connection") },
		{ Flag,			"route_noexec",					0, translate("Don't add routes automatically") },

		{ ListValue,	"mtu_disc",						{ "yes", "maybe", "no" }, translate("Enable Path MTU discovery") },
		{ Flag,			"mtu_test",						0, translate("Empirically measure MTU") },
		{ Flag,			"comp_lzo",						0, translate("Use fast LZO compression") },
		{ Flag,			"comp_noadapt",					0,		{ comp_lzo=1 }, translate("Don't use adaptive lzo compression") },
		{ Value,		"link_mtu",						1500, translate("Set TCP/UDP MTU") },
		{ Value,		"tun_mtu",						1500, translate("Set tun/tap device MTU") },
		{ Value,		"tun_mtu_extra",				1500, translate("Set tun/tap device overhead") },
		{ Value,		"fragment",						1500,	{ proto="udp" }, translate("Enable internal datagram fragmentation") },
		{ Value, 		"mssfix",						1500,	{ proto="udp" }, translate("Set upper bound on TCP MSS") },
		{ Value,		"sndbuf",						65536, translate("Set the TCP/UDP send buffer size") },
		{ Value,		"rcvbuf",						65536, translate("Set the TCP/UDP receive buffer size") },
		{ Value,		"txqueuelen",					100, translate("Set tun/tap TX queue length") },
		{ Value,		"shaper",						10240, translate("Shaping for peer bandwidth") },

		{ Value,		"inactive",						240, translate("tun/tap inactivity timeout") },
		{ Value,		"keepalive",					"10 60", translate("Helper directive to simplify the expression of --ping and --ping-restart in server mode configurations") },
		{ Value,		"ping",							30, translate("Ping remote every n seconds over TCP/UDP port") },
		{ Value,		"ping_exit",					120, translate("Remote ping timeout") },
		{ Value,		"ping_restart",					60, translate("Restart after remote ping timeout") },
		{ Flag,			"ping_timer_rem",				0, translate("Only process ping timeouts if routes exist") },

		{ Flag,			"persist_tun",					0, translate("Keep tun/tap device open on restart") },
		{ Flag,			"persist_key",					0, translate("Don't re-read key on restart") },
		{ Flag,			"persist_local_ip",				0, translate("Keep local IP address on restart") },
		{ Flag,			"persist_remote_ip",			0, translate("Keep remote IP address on restart") },

		-- management channel
		{ Value,		"management",					"127.0.0.1 31194 /etc/openvpn/mngmt-pwds", translate("Enable management interface on <em>IP</em> <em>port</em>") },
		{ Flag,			"management_query_passwords",	0, translate("Query management channel for private key") },	-- management
		{ Flag,			"management_hold",				0, translate("Start OpenVPN in a hibernating state") },	-- management
		{ Value,		"management_log_cache",			100, translate("Number of lines for log file history") },	-- management
		{ ListValue,	"topology",						{ "net30", "p2p", "subnet" },	{dev_type="tun" }, translate("'net30', 'p2p', or 'subnet'") },
	} },

	{ "vpn", {
		{ Value,		"server",						"10.200.200.0 255.255.255.0",	{ server_mode="1" }, translate("Configure server mode") },
		{ Value,		"server_bridge",				"10.200.200.1 255.255.255.0 10.200.200.200 10.200.200.250",	{ server_mode="1" }, translate("Configure server bridge") },
		{ DynamicList,	"push",							{ "redirect-gateway", "comp-lzo" },	{ server_mode="1" }, translate("Push options to peer") },
		{ Flag,			"push_reset",					0,	{ server_mode="1" }, translate("Don't inherit global push options") },
		{ Flag,			"disable",						0,	{ server_mode="1" }, translate("Client is disabled") },
		{ Value,		"ifconfig_pool",				"10.200.200.100 10.200.200.150 255.255.255.0",	{ server_mode="1" }, translate("Set aside a pool of subnets") },
		{ Value,		"ifconfig_pool_persist",		"/etc/openvpn/ipp.txt 600",	{ server_mode="1" }, translate("Persist/unpersist ifconfig-pool") },
--		{ Flag,			"ifconfig_pool_linear",			0,	{ server_mode="1" }, translate("Use individual addresses rather than /30 subnets") }, -- deprecated and replaced by --topology p2p
		{ Value,		"ifconfig_push",				"10.200.200.1 255.255.255.255",	{ server_mode="1" }, translate("Push an ifconfig option to remote") },
		{ Value,		"iroute",						"10.200.200.0 255.255.255.0",	{ server_mode="1" }, translate("Route subnet to client") },
		{ Flag,			"client_to_client",				0,	{ server_mode="1" }, translate("Allow client-to-client traffic") },
		{ Flag,			"duplicate_cn",					0,	{ server_mode="1" }, translate("Allow multiple clients with same certificate") },
		{ Value,		"client_config_dir",			"/etc/openvpn/ccd",	{ server_mode="1" }, translate("Directory for custom client config files") },
		{ Flag,			"ccd_exclusive",				0,	{ server_mode="1" }, translate("Refuse connection if no custom client config") },
		{ Value,		"tmp_dir",						"/var/run/openvpn",	{ server_mode="1" }, translate("Temporary directory for client-connect return file") },
		{ Value,		"hash_size",					"256 256",	{ server_mode="1" }, translate("Set size of real and virtual address hash tables") },
		{ Value,		"bcast_buffers",				256,	{ server_mode="1" }, translate("Number of allocated broadcast buffers") },
		{ Value,		"tcp_queue_limit",				64,	{ server_mode="1" }, translate("Maximum number of queued TCP output packets") },
		{ Value,		"max_clients",					10,	{ server_mode="1" }, translate("Allowed maximum of connected clients") },
		{ Value,		"max_routes_per_client",		256,	{ server_mode="1" }, translate("Allowed maximum of internal") },
		{ Value,		"connect_freq",					"3 10",	{ server_mode="1" }, translate("Allowed maximum of new connections") },
		{ Flag,			"client_cert_not_required",		0,	{ server_mode="1" }, translate("Don't require client certificate") },
		{ Flag,			"username_as_common_name",		0,	{ server_mode="1" }, translate("Use username as common name") },
		{ Flag,			"client",						0,	{ server_mode="0" }, { server_mode="" }, translate("Configure client mode") },
		{ Flag,			"pull",							0,	{ client="1" }, translate("Accept options pushed from server") },
		{ Value,		"auth_user_pass",				"/etc/openvpn/userpass.txt",	{ client="1" }, translate("Authenticate using username/password") },
		{ ListValue,	"auth_retry",					{ "none", "nointeract", "interact" },	{ client="1" }, translate("Handling of authentication failures") },
		{ Value,		"explicit_exit_notify",			1,	{ client="1" }, translate("Send notification to peer on disconnect") },
		{ DynamicList,	"remote",						"1.2.3.4",	{ client="1" }, translate("Remote host name or ip address") },		-- client
		{ Flag,			"remote_random",				1,	{ client="1" }, translate("Randomly choose remote server") },				-- client
		{ ListValue,	"proto",						{ "udp", "tcp-client", "tcp-server" },	{ client="1" }, translate("Use protocol") },
		{ Value,		"connect_retry",				5,	{ proto="tcp-client" }, { client="1" }, translate("Connection retry interval") },				-- client && proto=tcp-client
		{ Value,		"http_proxy", 					"192.168.1.100 8080",	{ client="1" }, translate("Connect to remote host through an HTTP proxy") },	-- client
		{ Flag,			"http_proxy_retry",				0,	{ client="1" }, translate("Retry indefinitely on HTTP proxy errors") },				-- client && http_proxy
		{ Value,		"http_proxy_timeout",			5,	{ client="1" }, translate("Proxy timeout in seconds") },				-- client && http_proxy
		{ DynamicList,	"http_proxy_option",			{ "VERSION 1.0", "AGENT OpenVPN/2.0.9" },	{ client="1" }, translate("Set extended HTTP proxy options") },	-- client && http_proxy
		{ Value,		"socks_proxy", 					"192.168.1.200 1080",	{ client="1" }, translate("Connect through Socks5 proxy") },	-- client
		{ Value,		"socks_proxy_retry",			5,	{ client="1" }, translate("Retry indefinitely on Socks proxy errors") },					-- client && socks_proxy
		{ Value,		"resolv_retry",					"infinite",	{ client="1" }, translate("If hostname resolve fails, retry") },			-- client
		{ ListValue,	"redirect_gateway",				{ "", "local", "def1", "local def1" },	{ client="1" }, translate("Automatically redirect default route") }, -- client
	} },

	{ "cryptography", {
		{ Value,		"secret",						"/etc/openvpn/secret.key 1", translate("Enable Static Key encryption mode (non-TLS)") },
		{ Value,		"auth",							"SHA1", translate("HMAC authentication for packets") }, -- parse
		{ Value,		"cipher",						"BF-CBC", translate("Encryption cipher for packets") }, -- parse
		{ Value,		"keysize",						1024, translate("Size of cipher key") }, -- parse
		{ Value,		"engine",						"dynamic", translate("Enable OpenSSL hardware crypto engines") }, -- parse
		{ Flag,			"no_replay",					0, translate("Disable replay protection") },
		{ Value,		"replay_window",				"64 15", translate("Replay protection sliding window size") },
		{ Flag,			"mute_replay_warnings",			0, translate("Silence the output of replay warnings") },
		{ Value,		"replay_persist",				"/var/run/openvpn-replay-state", translate("Persist replay-protection state") },
		{ Flag,			"no_iv",						0, translate("Disable cipher initialisation vector") },
		{ Flag,			"tls_server",					0, { tls_client="" }, { tls_client="0" }, translate("Enable TLS and assume server role") },
		{ Flag,			"tls_client",					0, { tls_server="" }, { tls_server="0" }, translate("Enable TLS and assume client role") },
		{ FileUpload,	"ca",							"/etc/easy-rsa/keys/ca.crt", translate("Certificate authority") },
		{ FileUpload,	"dh",							"/etc/easy-rsa/keys/dh1024.pem", translate("Diffie Hellman parameters") },
		{ FileUpload,	"cert",							"/etc/easy-rsa/keys/some-client.crt", translate("Local certificate") },
		{ FileUpload,	"key",							"/etc/easy-rsa/keys/some-client.key", translate("Local private key") },
		{ FileUpload,	"pkcs12",						"/etc/easy-rsa/keys/some-client.pk12", translate("PKCS#12 file containing keys") },
		{ ListValue,	"key_method",					{ 1, 2 }, translate("Enable TLS and assume client role") },
		{ Value,		"tls_cipher",					"DHE-RSA-AES256-SHA:DHE-DSS-AES256-SHA:AES256-SHA:EDH-RSA-DES-CBC3-SHA:EDH-DSS-DES-CBC3-SHA:DES-CBC3-SHA:DHE-RSA-AES128-SHA:DHE-DSS-AES128-SHA:AES128-SHA:RC4-SHA:RC4-MD5:EDH-RSA-DES-CBC-SHA:EDH-DSS-DES-CBC-SHA:DES-CBC-SHA:EXP-EDH-RSA-DES-CBC-SHA:EXP-EDH-DSS-DES-CBC-SHA:EXP-DES-CBC-SHA:EXP-RC2-CBC-MD5:EXP-RC4-MD5", translate("TLS cipher") },
		{ Value,		"tls_timeout",					2, translate("Retransmit timeout on TLS control channel") },
		{ Value,		"reneg_bytes",					1024, translate("Renegotiate data chan. key after bytes") },
		{ Value,		"reneg_pkts",					100, translate("Renegotiate data chan. key after packets") },
		{ Value,		"reneg_sec",					3600, translate("Renegotiate data chan. key after seconds") },
		{ Value,		"hand_window",					60, translate("Timeframe for key exchange") },
		{ Value,		"tran_window",					3600, translate("Key transition window") },
		{ Flag,			"single_session",				0, translate("Allow only one session") },
		{ Flag,			"tls_exit",						0, translate("Exit on TLS negotiation failure") },
		{ Value,		"tls_auth",						"/etc/openvpn/tlsauth.key 1", translate("Additional authentication over TLS") },
		--{ Value,		"askpass",						"[file]", translate("Get PEM password from controlling tty before we daemonize") },
		{ Flag,			"auth_nocache",					0, translate("Don't cache --askpass or --auth-user-pass passwords") },
		{ Value,		"tls_remote",					"remote_x509_name", translate("Only accept connections from given X509 name") },
		{ ListValue,	"ns_cert_type",					{ "client", "server" }, translate("Require explicit designation on certificate") },
		{ ListValue,	"remote_cert_tls",				{ "client", "server" }, translate("Require explicit key usage on certificate") },
		{ Value,		"crl_verify",					"/etc/easy-rsa/keys/crl.pem", translate("Check peer certificate against a CRL") },
 	} }
}


local cts = { }
local params = { }

local m = Map("openvpn")
local p = m:section( SimpleSection )

p.template = "openvpn/pageswitch"
p.mode     = "advanced"
p.instance = arg[1]
p.category = arg[2] or "service"

for _, c in ipairs(knownParams) do
	cts[#cts+1] = c[1]
	if c[1] == p.category then params = c[2] end
end

p.categories = cts


local s = m:section(
	NamedSection, arg[1], "openvpn",
	translate("openvpn_%s" % arg[2]),
	translate("openvpn_%s_desc" % arg[2])
)

s.title     = translate("openvpn_%s" % arg[2])
s.addremove = false
s.anonymous = true


for _, option in ipairs(params) do
	local o = s:option(
		option[1], option[2],
		option[2], option[4]
	)

	if option[1] == DummyValue then
		o.value = option[3]
	else
		if option[1] == DynamicList then
			o.cast = nil
			function o.cfgvalue(...)
				local val = AbstractValue.cfgvalue(...)
				return ( val and type(val) ~= "table" ) and { val } or val
			end
		end

		o.optional = true

		if type(option[3]) == "table" then
			if o.optional then o:value("", "-- remove --") end
			for _, v in ipairs(option[3]) do
				v = tostring(v)
				o:value(v)
			end
			o.default = tostring(option[3][1])
		else
			o.default = tostring(option[3])
		end
	end

	for i=5,#option do
		if type(option[i]) == "table" then
			o:depends(option[i])
		end
	end
end

return m
