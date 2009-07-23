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


local basicParams = {
	--
	-- Widget		Name					Optn.	Default(s)
	--

	{ ListValue,	"verb",					{ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11 } },
	{ Value,		"nice",					0 },
	{ Value,		"port",					1194 },
	{ ListValue,	"dev_type",				{ "tun", "tap" } },
	{ Flag,			"tun_ipv6",				0 },

	{ Value,		"ifconfig",				"10.200.200.3 10.200.200.1" },
	{ Value,		"server",				"10.200.200.0 255.255.255.0" },
	{ Value,		"server_bridge",		"192.168.1.1 255.255.255.0 192.168.1.128 192.168.1.254" },
	{ Flag,			"nobind",				0 },

	{ Flag,			"comp_lzo",				0 },
	{ Value,		"keepalive",			"10 60" },

	{ ListValue,	"proto",				{ "udp", "tcp" } },

	{ Flag,			"client",				0 },
	{ Flag,			"client_to_client",		0 },
	{ DynamicList,	"remote",				"vpnserver.example.org" },

	{ FileUpload,	"secret",				"/etc/openvpn/secret.key 1" },
	{ FileUpload,	"pkcs12",				"/etc/easy-rsa/keys/some-client.pk12" },
	{ FileUpload,	"ca",					"/etc/easy-rsa/keys/ca.crt" },
	{ FileUpload,	"dh",					"/etc/easy-rsa/keys/dh1024.pem" },
	{ FileUpload,	"cert",					"/etc/easy-rsa/keys/some-client.crt" },
	{ FileUpload,	"key",					"/etc/easy-rsa/keys/some-client.key" },
}


local m = Map("openvpn")
local p = m:section( SimpleSection )

p.template = "openvpn/pageswitch"
p.mode     = "basic"
p.instance = arg[1]


local s = m:section( NamedSection, arg[1], "openvpn" )

for _, option in ipairs(basicParams) do
	local o = s:option(
		option[1], option[2],
		translate("openvpn_param_%s" % option[2]),
		translate("openvpn_param_%s_desc" % option[2])
	)
	
	o.optional = true

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
