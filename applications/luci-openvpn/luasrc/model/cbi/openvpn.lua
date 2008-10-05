--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id: olsrdplugins.lua 3288 2008-09-14 20:57:00Z jow $
]]--

require("luci.fs")
require("luci.ip")


local knownParams = {
	--
	-- Widget		Name					Optn.	Default(s)
	--

	{ "service", {
		-- initialisation and daemon options
		{ "daemon", {
			{ ListValue,	"verb",					false,	{ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11 } },
			{ Flag,			"mlock",				false,	0 },
			{ Flag,			"disable_occ",			false,	0 },
		--	{ Value,		"user",					true,	"root" },
		--	{ Value,		"group",				true,	"root" },
			{ Value,		"cd",					true,	"/etc/openvpn" },
			{ Value,		"chroot",				true,	"/var/run" },
		--	{ Value,		"daemon",				true,	"Instance-Name" },
		--	{ Value,		"syslog",				true,	"Instance-Name" },
			{ Flag,			"passtos",				false,	0 },
		--	{ Value,		"inetd",				true,	"nowait Instance-Name" },
			{ Value,		"log",					true,	"/var/log/openvpn.log" },
			{ Value,		"log_append",			true,	"/var/log/openvpn.log" },
			{ Flag,			"suppress_timestamps",	false,	0 },
		--	{ Value,		"writepid",				true,	"/var/run/openvpn.pid" },
			{ Value,		"nice",					true,	0 },
			{ Flag,			"fast_io",				false,	0 },
			{ Value,		"echo",					true,	"some params echoed to log" },
			{ ListValue,	"remap_usr1",			true,	{ "SIGHUP", "SIGTERM" } },
			{ Value,		"status",				true,	"/var/run/openvpn.status 5" },
			{ Value,		"status_version",		true,	{ 1, 2 } },	-- status
			{ Value,		"mute",					true,	5 },
		} },

		-- hook scripts
		{ "hookscripts", {
			{ Value,		"up",					true,	"/usr/bin/ovpn-up" },
			{ Value,		"up_delay",				true,	5 },
			{ Value,		"down",					true,	"/usr/bin/ovpn-down" },
			{ Flag,			"down_pre",				false,	0 },
			{ Flag,			"up_restart",			false,	0 },
			{ Value,		"route_up",				true,	"/usr/bin/ovpn-routeup" },
			{ Value,		"ipchange",				true,	"/usr/bin/ovpn-ipchange",	{ mode="p2p" } },
			{ DynamicList,	"setenv",				true,	{ "VAR1 value1", "VAR2 value2" } },
			{ Value,		"tls_verify",			true,	"/usr/bin/ovpn-tlsverify" },
			{ Value,		"client_connect",		true,	"/usr/bin/ovpn-clientconnect" },
			{ Flag,			"client_disconnect",	false,	0 },
			{ Value,		"learn_address",		true,	"/usr/bin/ovpn-learnaddress" },
			{ Value,		"auth_user_pass_verify",	true,	"/usr/bin/ovpn-userpass via-env" },
		} },
	} },

	{ "networking", {
		-- socket config
		{ "networking", {
			{ ListValue,	"mode",					false,	{ "p2p", "server" } },
			{ Value,		"local",				false,	"0.0.0.0" },
			{ Value,		"port",					false,	1194 },
			{ Value,		"lport",				true,	1194 },
			{ Value,		"rport",				true,	1194 },
			{ Flag,			"float",				true,	0 },
			{ Flag,			"nobind",				true,	0 },

			{ Value,		"dev",					true,	"tun0" },
			{ ListValue,	"dev_type",				false,	{ "tun", "tap" } },
			{ Value,		"dev_node",				true,	"/dev/net/tun" },
			{ Flag,			"tun_ipv6",				false,	0 },

			{ Value,		"ifconfig",				true,	"10.200.200.3 10.200.200.1" },
			{ Flag,			"ifconfig_noexec",		false,	0 },
			{ Flag,			"ifconfig_nowarn",		false,	0 },

			{ DynamicList,	"route",				true,	"10.123.0.0 255.255.0.0" },
			{ Value,		"route_gateway",		true,	"10.234.1.1" },
			{ Value,		"route_delay",			true,	0 },
			{ Flag,			"route_noexec",			false,	0 },

			{ ListValue,	"redirect_gateway",		false,	{ "", "local", "def1", "local def1" } }, -- client
		} },

		-- connection tuning
		{ "conntune", {
			{ ListValue,	"mtu_disc",				false,	{ "yes", "maybe", "no" } },
			{ Flag,			"mtu_test",				false,	0 },
			{ Flag,			"comp_lzo",				false,	0 },
			{ Flag,			"comp_noadept",			false,	0,		{ comp_lzo=1 } },
			{ Value,		"link_mtu",				true,	1500 },
			{ Value,		"tun_mtu",				true,	1500 },
			{ Value,		"tun_mtu_extra",		true,	1500 },
			{ Value,		"fragment",				true,	1500,	{ proto="udp" } },
			{ Value, 		"mssfix",				true,	1500,	{ proto="udp" } },
			{ Value,		"sndbuf",				true,	65536 },
			{ Value,		"rcvbuf",				true,	65536 },
			{ Value,		"txqueuelen",			true,	100 },
			{ Value,		"shaper",				true,	10240 },
		} },

		-- idle timeouts & persistence
		{ "timeouts", {
			{ Value,		"inactive",				true,	240 },
			{ Value,		"keepalive",			true,	"10 60" },
			{ Value,		"ping",					true,	30 },
			{ Value,		"ping_exit",			true,	120 },
			{ Value,		"ping_restart",			true,	60 },
			{ Flag,			"ping_timer_rem",		false,	0 },

			{ Flag,			"persist_tun",			false,	0 },
			{ Flag,			"persist_key",			false,	0 },
			{ Flag,			"persist_local_ip",		false,	0 },
			{ Flag,			"persist_remote_ip",	false,	0 },
		} },

		-- management channel
		{ "management", {
			{ Value,		"management",			false,	"127.0.0.1 31194 /etc/openvpn/mngmt-pwds" },
			{ Flag,			"management_query_passwords",
													true,	0 },	-- management
			{ Flag,			"management_hold",		true,	0 },	-- management
			{ Flag,			"management_log_cache",	true,	100 },	-- management
		} }
	} },

	{ "role", {
		{ "server", {
			{ Value,		"server",				true,	"10.200.200.0 255.255.255.0" },
			{ Value,		"server_bridge",		true,	"10.200.200.1 255.255.255.0 10.200.200.200 10.200.200.250" },
			{ DynamicList,	"push",					true,	{ "redirect-gateway", "comp-lzo" } },
			{ Flag,			"push_reset",			false,	0 },
			{ Flag,			"disable",				false,	0 },
			{ Value,		"ifconfig_pool",		true,	"10.200.200.100 10.200.200.150 255.255.255.0" },
			{ Value,		"ifconfig_pool_persist",	true,	"/etc/openvpn/ipp.txt 600" },
			{ Flag,			"ifconfig_pool_linear",	false,	0 },
			{ Value,		"ifconfig_push",		true,	"10.200.200.1 255.255.255.255" },
			{ Value,		"iroute",				true,	"10.200.200.0 255.255.255.0" },
			{ Flag,			"client_to_client",		false,	0 },
			{ Flag,			"duplicate_cn",			false,	0 },
			{ Value,		"client_config_dir",	true,	"/etc/openvpn/ccd" },
			{ Flag,			"ccd_exclusive",		false,	0 },
			{ Value,		"tmp_dir",				true,	"/var/run/openvpn" },
			{ Value,		"hash_size",			true,	"256 256" },
			{ Value,		"bcast_buffers",		true,	256 },
			{ Value,		"tcp_queue_limit",		true,	64 },
			{ Value,		"max_clients",			true,	10 },
			{ Value,		"max_routes_per_client",	true,	256 },
			{ Value,		"connect_freq",			true,	"3 10" },
			{ Flag,			"client_cert_not_required",	false,	0 },
			{ Flag,			"username_as_common_name",	false,	0 },
		} },

		{ "client", {
			{ Flag,			"client",				false,	0 },
			{ Flag,			"pull",					false,	0 },
			{ Value,		"auth_user_pass",		true,	"/etc/openvpn/userpass.txt" },
			{ ListValue,	"auth_retry",			true,	{ "none", "nointeract", "interact" } },
			{ Value,		"explicit_exit_notify",	true,	1 },
			{ DynamicList,	"remote",				false,	"1.2.3.4" },		-- client
			{ Flag,			"remote_random",		false,	1 },				-- client
			{ ListValue,	"proto",				false,	{ "udp", "tcp-client", "tcp-server" } },
			{ Value,		"connect_retry",		true,	5,	{ proto="tcp-client" } },				-- client && proto=tcp-client
			{ Value,		"http_proxy_server", 	true,	"192.168.1.100 8080" },	-- client
			{ Flag,			"http_proxy_retry",		false,	0 },				-- client && http_proxy_server
			{ Value,		"http_proxy_timeout",	true,	5 },				-- client && http_proxy_server
			{ DynamicList,	"http_proxy_option",	true,	{ "VERSION 1.0", "AGENT OpenVPN/2.0.9" } },	-- client && http_proxy_server
			{ Value,		"socks_proxy_server", 	true,	"192.168.1.200 1080" },	-- client
			{ Value,		"socks_proxy_retry",	true,	5 },					-- client && socks_proxy_server
			{ Value,		"resolv_retry",			true,	"infinite" },			-- client
		} }
	} },

	{ "cryptography", {
		{ "datachannel", {
			{ Value,		"secret",				true,	"/etc/openvpn/secret.key 1" },
			{ Value,		"auth",					true,	"SHA1" }, -- parse
			{ Value,		"cipher",				true,	"BF-CBC" }, -- parse
			{ Value,		"keysize",				true,	1024 }, -- parse
			{ Value,		"engine",				true,	"dynamic" }, -- parse
			{ Flag,			"no_replay",			false,	0 },
			{ Value,		"replay_window",		true,	"64 15" },
			{ Flag,			"mute_replay_warnings",	false,	0 },
			{ Value,		"replay_persist",		true,	"/var/run/openvpn-replay-state" },
			{ Flag,			"no_iv",				false,	0 },
		} },

		{ "tlsmode", {
			{ Flag,			"tls_server",			false,	0 },
			{ Flag,			"tls_client",			false,	0 },
			{ Value,		"ca",					true,	"/etc/easy-rsa/keys/ca.crt" },
			{ Value,		"dh",					true,	"/etc/easy-rsa/keys/dh1024.pem" },
			{ Value,		"cert",					true,	"/etc/easy-rsa/keys/some-client.crt" },
			{ Value,		"key",					true,	"/etc/easy-rsa/keys/some-client.key" },
			{ Value,		"pkcs12",				true,	"/etc/easy-rsa/keys/some-client.pk12" },
			{ ListValue,	"key_method",			true,	{ 1, 2 } },
			{ Value,		"tls_cipher",			true,	"DHE-RSA-AES256-SHA:DHE-DSS-AES256-SHA:AES256-SHA:EDH-RSA-DES-CBC3-SHA:EDH-DSS-DES-CBC3-SHA:DES-CBC3-SHA:DHE-RSA-AES128-SHA:DHE-DSS-AES128-SHA:AES128-SHA:RC4-SHA:RC4-MD5:EDH-RSA-DES-CBC-SHA:EDH-DSS-DES-CBC-SHA:DES-CBC-SHA:EXP-EDH-RSA-DES-CBC-SHA:EXP-EDH-DSS-DES-CBC-SHA:EXP-DES-CBC-SHA:EXP-RC2-CBC-MD5:EXP-RC4-MD5" },
			{ Value,		"tls_timeout",			true,	2 },
			{ Value,		"reneg_bytes",			true,	1024 },
			{ Value,		"reneg_pkts",			true,	100 },
			{ Value,		"reneg_sec",			true,	3600 },
			{ Value,		"hand_window",			true,	60 },
			{ Value,		"tran_window",			true,	3600 },
			{ Flag,			"single_session",		false,	0 },
			{ Flag,			"tls_exit",				false,	0 },
			{ Value,		"tls_auth",				true,	"/etc/openvpn/tlsauth.key 1" },
			--{ Value,		"askpass",				true,	"[file]" },
			{ Flag,			"auth_nocache",			false,	0 },
			{ Value,		"tls_remote",			true,	"remote_x509_name" },
			{ ListValue,	"ns_cert_type",			true,	{ "client", "server" } },
			{ Value,		"crl_verify",			true,	"/etc/easy-rsa/keys/crl.pem" },
		} }
 	} }
}


local cts = { }
local params = { }

local m = Map("openvpn")
local p = m:section( SimpleSection )

p.template = "openvpn/pageswitch"
p.category = arg[1]
p.csection = arg[2]
p.instance = arg[3]

for _, c in ipairs(knownParams) do
	cts[#cts+1] = { c[1], { } }
	for _, o in ipairs(c[2]) do
		cts[#cts][2][#cts[#cts][2]+1] = o[1]
		if c[1] == p.category and o[1] == p.csection then
			params = o[2]
		end
	end
end

p.categories = cts


local s = m:section(
	NamedSection, arg[3], "openvpn",
	translate("openvpn_%s" % arg[2]),
	translate("openvpn_%s_desc" % arg[2])
)

s.title     = translate("openvpn_%s" % arg[2])
s.addremove = false
s.anonymous = true


for _, option in ipairs(params) do
	local o = s:option(option[1], option[2])

	o.optional = option[3]

	if type(option[4]) == "table" then
		if o.optional then o:value("", "-- remove --") end
		for _, v in ipairs(option[4]) do
			v = tostring(v)
			o:value(v)
		end
		o.default = tostring(option[4][1])
	else
		o.default = tostring(option[4])
	end

	for i=5,#option do
		if type(option[i]) == "table" then
			o:depends(option[i])
		end
	end
end

return m
