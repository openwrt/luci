-- Copyright 2015 Jian Chang <aa65535@live.com>
-- Licensed to the public under the Apache License 2.0.

local m, s, o, e, a

if luci.sys.call("pidof ss-redir >/dev/null") == 0 then
	m = Map("shadowsocks-libev", translate("ShadowSocks-libev"), translate("ShadowSocks-libev is running"))
else
	m = Map("shadowsocks-libev", translate("ShadowSocks-libev"), translate("ShadowSocks-libev is not running"))
end

-- Global Setting
s = m:section(TypedSection, "shadowsocks-libev", translate("Global Setting"))
s.anonymous = true

o = s:option(Flag, "enable", translate("Enable"))
o.default = 1
o.rmempty = false

o = s:option(Value, "server", translate("Server Address"))
o.datatype = "host"
o.rmempty = false

o = s:option(Value, "server_port", translate("Server Port"))
o.datatype = "port"
o.rmempty = false

o = s:option(Value, "local_port", translate("Local Port"))
o.datatype = "port"
o.default = 1080
o.rmempty = false

o = s:option(Value, "timeout", translate("Connection Timeout"))
o.datatype = "uinteger"
o.default = 60
o.rmempty = false

o = s:option(Value, "password", translate("Password"))
o.password = true
o.rmempty = false

e = {
	"table",
	"rc4",
	"rc4-md5",
	"aes-128-cfb",
	"aes-192-cfb",
	"aes-256-cfb",
	"bf-cfb",
	"camellia-128-cfb",
	"camellia-192-cfb",
	"camellia-256-cfb",
	"cast5-cfb",
	"des-cfb",
	"idea-cfb",
	"rc2-cfb",
	"seed-cfb",
	"salsa20",
	"chacha20",
}

o = s:option(ListValue, "encrypt_method", translate("Encrypt Method"))
for i,v in ipairs(e) do
	o:value(v)
end
o.rmempty = false

-- Proxy Setting
s = m:section(TypedSection, "shadowsocks-libev", translate("Proxy Setting"))
s.anonymous = true

o = s:option(ListValue, "udp_relay", translate("Proxy Protocol"))
o:value("0", translate("TCP only"))
o:value("1", translate("TCP+UDP"))
o.default = 1
o.rmempty = false

o = s:option(Value, "ignore_list", translate("Ignore List"))
o:value("/dev/null", translate("Disabled"))
o.default = "/dev/null"
o.rmempty = false

-- UDP Forward
s = m:section(TypedSection, "shadowsocks-libev", translate("UDP Forward"))
s.anonymous = true

o = s:option(Flag, "tunnel_enable", translate("Enable"))
o.default = 1
o.rmempty = false

o = s:option(Value, "tunnel_port", translate("UDP Local Port"))
o.datatype = "port"
o.default = 5300

o = s:option(Value, "tunnel_forward", translate("Forwarding Tunnel"))
o.default = "8.8.4.4:53"

-- Access Control
s = m:section(TypedSection, "shadowsocks-libev", translate("Access Control"))
s.anonymous = true

s:tab("lan_ac", translate("LAN"))

o = s:taboption("lan_ac", ListValue, "lan_ac_mode", translate("Access Control"))
o:value("0", translate("Disabled"))
o:value("1", translate("Allow listed only"))
o:value("2", translate("Allow all except listed"))
o.default = 0
o.rmempty = false

a = luci.sys.net.arptable() or {}

o = s:taboption("lan_ac", DynamicList, "lan_ac_ip", translate("LAN IP List"))
o.datatype = "ipaddr"
for i,v in ipairs(a) do
	o:value(v["IP address"])
end

s:tab("wan_ac", translate("WAN"))

o = s:taboption("wan_ac", DynamicList, "wan_bp_ip", translate("Bypassed IP"))
o.datatype = "ip4addr"

o = s:taboption("wan_ac", DynamicList, "wan_fw_ip", translate("Forwarded IP"))
o.datatype = "ip4addr"

return m
