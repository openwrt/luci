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


local knownParams = {
	--
	-- Widget		Name					Optn.	Default(s)
	--

	{ "service", {
		-- initialisation and daemon options
		{ ListValue,	"verb",						{ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11 } },
		{ Flag,			"mlock",					0 },
		{ Flag,			"disable_occ",				0 },
	--	{ Value,		"user",						"root" },
	--	{ Value,		"group",					"root" },
		{ Value,		"cd",						"/etc/openvpn" },
		{ Value,		"chroot",					"/var/run" },
	--	{ Value,		"daemon",					"Instance-Name" },
	--	{ Value,		"syslog",					"Instance-Name" },
		{ Flag,			"passtos",					0 },
	--	{ Value,		"inetd",					"nowait Instance-Name" },
		{ Value,		"log",						"/var/log/openvpn.log" },
		{ Value,		"log_append",				"/var/log/openvpn.log" },
		{ Flag,			"suppress_timestamps",		0 },
	--	{ Value,		"writepid",					"/var/run/openvpn.pid" },
		{ Value,		"nice",						0 },
		{ Flag,			"fast_io",					0 },
		{ Value,		"echo",						"some params echoed to log" },
		{ ListValue,		"remap_usr1",			{ "SIGHUP", "SIGTERM" } },
		{ Value,		"status",					"/var/run/openvpn.status 5" },
		{ Value,		"status_version",			{ 1, 2 } },	-- status
		{ Value,		"mute",						5 },

		{ Value,		"up",						"/usr/bin/ovpn-up" },
		{ Value,		"up_delay",					5 },
		{ Value,		"down",						"/usr/bin/ovpn-down" },
		{ Flag,			"down_pre",					0 },
		{ Flag,			"up_restart",				0 },
		{ Value,		"route_up",					"/usr/bin/ovpn-routeup" },
		{ Value,		"ipchange",					"/usr/bin/ovpn-ipchange",	{ mode="p2p" } },
		{ DynamicList,	"setenv",					{ "VAR1 value1", "VAR2 value2" } },
		{ Value,		"tls_verify",				"/usr/bin/ovpn-tlsverify" },
		{ Value,		"client_connect",			"/usr/bin/ovpn-clientconnect" },
		{ Flag,			"client_disconnect",		0 },
		{ Value,		"learn_address",			"/usr/bin/ovpn-learnaddress" },
		{ Value,		"auth_user_pass_verify",	"/usr/bin/ovpn-userpass via-env" },
	} },

	{ "networking", {
		-- socket config
		{ ListValue,	"mode",				{ "p2p", "server" } },
		{ Value,		"local",			"0.0.0.0" },
		{ Value,		"port",				1194 },
		{ Value,		"lport",			1194 },
		{ Value,		"rport",			1194 },
		{ Flag,			"float",			0 },
		{ Flag,			"nobind",			0 },

		{ Value,		"dev",				"tun0" },
		{ ListValue,	"dev_type",			{ "tun", "tap" } },
		{ Value,		"dev_node",			"/dev/net/tun" },
		{ Flag,			"tun_ipv6",			0 },

		{ Value,		"ifconfig",			"10.200.200.3 10.200.200.1" },
		{ Flag,			"ifconfig_noexec",		0 },
		{ Flag,			"ifconfig_nowarn",		0 },

		{ DynamicList,	"route",			"10.123.0.0 255.255.0.0" },
		{ Value,		"route_gateway",		"10.234.1.1" },
		{ Value,		"route_delay",			0 },
		{ Flag,			"route_noexec",			0 },

		{ ListValue,	"mtu_disc",			{ "yes", "maybe", "no" } },
		{ Flag,			"mtu_test",			0 },
		{ Flag,			"comp_lzo",			0 },
		{ Flag,			"comp_noadept",			0,		{ comp_lzo=1 } },
		{ Value,		"link_mtu",			1500 },
		{ Value,		"tun_mtu",			1500 },
		{ Value,		"tun_mtu_extra",		1500 },
		{ Value,		"fragment",			1500,	{ proto="udp" } },
		{ Value, 		"mssfix",			1500,	{ proto="udp" } },
		{ Value,		"sndbuf",			65536 },
		{ Value,		"rcvbuf",			65536 },
		{ Value,		"txqueuelen",			100 },
		{ Value,		"shaper",			10240 },

		{ Value,		"inactive",			240 },
		{ Value,		"keepalive",			"10 60" },
		{ Value,		"ping",				30 },
		{ Value,		"ping_exit",			120 },
		{ Value,		"ping_restart",			60 },
		{ Flag,			"ping_timer_rem",		0 },

		{ Flag,			"persist_tun",			0 },
		{ Flag,			"persist_key",			0 },
		{ Flag,			"persist_local_ip",		0 },
		{ Flag,			"persist_remote_ip",		0 },

		-- management channel
		{ Value,		"management",			"127.0.0.1 31194 /etc/openvpn/mngmt-pwds" },
		{ Flag,			"management_query_passwords",	0 },	-- management
		{ Flag,			"management_hold",		0 },	-- management
		{ Flag,			"management_log_cache",		100 },	-- management
	} },

	{ "vpn", {
		{ Value,		"server",					"10.200.200.0 255.255.255.0", { server_mode="1" } },
		{ Value,		"server_bridge",			"10.200.200.1 255.255.255.0 10.200.200.200 10.200.200.250", { server_mode="1" } },
		{ DynamicList,	"push",						{ "redirect-gateway", "comp-lzo" }, { server_mode="1" } },
		{ Flag,			"push_reset",				0, { server_mode="1" } },
		{ Flag,			"disable",					0, { server_mode="1" } },
		{ Value,		"ifconfig_pool",			"10.200.200.100 10.200.200.150 255.255.255.0", { server_mode="1" } },
		{ Value,		"ifconfig_pool_persist",	"/etc/openvpn/ipp.txt 600", { server_mode="1" } },
		{ Flag,			"ifconfig_pool_linear",		0, { server_mode="1" } },
		{ Value,		"ifconfig_push",			"10.200.200.1 255.255.255.255", { server_mode="1" } },
		{ Value,		"iroute",					"10.200.200.0 255.255.255.0", { server_mode="1" } },
		{ Flag,			"client_to_client",			0, { server_mode="1" } },
		{ Flag,			"duplicate_cn",				0, { server_mode="1" } },
		{ Value,		"client_config_dir",		"/etc/openvpn/ccd", { server_mode="1" } },
		{ Flag,			"ccd_exclusive",			0, { server_mode="1" } },
		{ Value,		"tmp_dir",					"/var/run/openvpn", { server_mode="1" } },
		{ Value,		"hash_size",				"256 256", { server_mode="1" } },
		{ Value,		"bcast_buffers",			256, { server_mode="1" } },
		{ Value,		"tcp_queue_limit",			64, { server_mode="1" } },
		{ Value,		"max_clients",				10, { server_mode="1" } },
		{ Value,		"max_routes_per_client",	256, { server_mode="1" } },
		{ Value,		"connect_freq",				"3 10", { server_mode="1" } },
		{ Flag,			"client_cert_not_required",	0, { server_mode="1" } },
		{ Flag,			"username_as_common_name",	0, { server_mode="1" } },
		{ Flag,			"client",					0, { server_mode="0" }, { server_mode="" } },
		{ Flag,			"pull",						0, { client="1" } },
		{ Value,		"auth_user_pass",			"/etc/openvpn/userpass.txt", { client="1" } },
		{ ListValue,	"auth_retry",				{ "none", "nointeract", "interact" }, { client="1" } },
		{ Value,		"explicit_exit_notify",		1, { client="1" } },
		{ DynamicList,	"remote",					"1.2.3.4", { client="1" } },		-- client
		{ Flag,			"remote_random",			1, { client="1" } },				-- client
		{ ListValue,	"proto",					{ "udp", "tcp-client", "tcp-server" }, { client="1" } },
		{ Value,		"connect_retry",			5,	{ proto="tcp-client" }, { client="1" } },				-- client && proto=tcp-client
		{ Value,		"http_proxy_server", 		"192.168.1.100 8080", { client="1" } },	-- client
		{ Flag,			"http_proxy_retry",			0, { client="1" } },				-- client && http_proxy_server
		{ Value,		"http_proxy_timeout",		5, { client="1" } },				-- client && http_proxy_server
		{ DynamicList,	"http_proxy_option",		{ "VERSION 1.0", "AGENT OpenVPN/2.0.9" }, { client="1" } },	-- client && http_proxy_server
		{ Value,		"socks_proxy_server", 		"192.168.1.200 1080", { client="1" } },	-- client
		{ Value,		"socks_proxy_retry",		5, { client="1" } },					-- client && socks_proxy_server
		{ Value,		"resolv_retry",				"infinite", { client="1" } },			-- client
		{ ListValue,	"redirect_gateway",			{ "", "local", "def1", "local def1" }, { client="1" } }, -- client
	} },

	{ "cryptography", {
		{ Value,		"secret",				"/etc/openvpn/secret.key 1" },
		{ Value,		"auth",					"SHA1" }, -- parse
		{ Value,		"cipher",				"BF-CBC" }, -- parse
		{ Value,		"keysize",				1024 }, -- parse
		{ Value,		"engine",				"dynamic" }, -- parse
		{ Flag,			"no_replay",			0 },
		{ Value,		"replay_window",		"64 15" },
		{ Flag,			"mute_replay_warnings",	0 },
		{ Value,		"replay_persist",		"/var/run/openvpn-replay-state" },
		{ Flag,			"no_iv",				0 },
		{ Flag,			"tls_server",			0, { tls_client="" }, { tls_client="0" } },
		{ Flag,			"tls_client",			0, { tls_server="" }, { tls_server="0" } },
		{ FileUpload,	"ca",					"/etc/easy-rsa/keys/ca.crt" },
		{ FileUpload,	"dh",					"/etc/easy-rsa/keys/dh1024.pem" },
		{ FileUpload,	"cert",					"/etc/easy-rsa/keys/some-client.crt" },
		{ FileUpload,	"key",					"/etc/easy-rsa/keys/some-client.key" },
		{ FileUpload,	"pkcs12",				"/etc/easy-rsa/keys/some-client.pk12" },
		{ ListValue,	"key_method",			{ 1, 2 } },
		{ Value,		"tls_cipher",			"DHE-RSA-AES256-SHA:DHE-DSS-AES256-SHA:AES256-SHA:EDH-RSA-DES-CBC3-SHA:EDH-DSS-DES-CBC3-SHA:DES-CBC3-SHA:DHE-RSA-AES128-SHA:DHE-DSS-AES128-SHA:AES128-SHA:RC4-SHA:RC4-MD5:EDH-RSA-DES-CBC-SHA:EDH-DSS-DES-CBC-SHA:DES-CBC-SHA:EXP-EDH-RSA-DES-CBC-SHA:EXP-EDH-DSS-DES-CBC-SHA:EXP-DES-CBC-SHA:EXP-RC2-CBC-MD5:EXP-RC4-MD5" },
		{ Value,		"tls_timeout",			2 },
		{ Value,		"reneg_bytes",			1024 },
		{ Value,		"reneg_pkts",			100 },
		{ Value,		"reneg_sec",			3600 },
		{ Value,		"hand_window",			60 },
		{ Value,		"tran_window",			3600 },
		{ Flag,			"single_session",		0 },
		{ Flag,			"tls_exit",				0 },
		{ Value,		"tls_auth",				"/etc/openvpn/tlsauth.key 1" },
		--{ Value,		"askpass",				"[file]" },
		{ Flag,			"auth_nocache",			0 },
		{ Value,		"tls_remote",			"remote_x509_name" },
		{ ListValue,	"ns_cert_type",			{ "client", "server" } },
		{ ListValue,	"remote_cert_tls",		{ "client", "server" } },
		{ Value,		"crl_verify",			"/etc/easy-rsa/keys/crl.pem" },
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
		translate("openvpn_param_%s" % option[2]),
		translate("openvpn_param_%s_desc" % option[2])
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
