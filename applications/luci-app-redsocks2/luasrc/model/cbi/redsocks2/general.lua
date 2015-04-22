--[[
 Redsocks2 基础配置页面
 Copyright (C) 2015 GuoGuo <gch981213@gmail.com>
]]--

m = Map("redsocks2", translate("Redsocks2 - General Settings"),
	translatef("A modified version of redsocks.Beside the basic function of redsocks,it can redirect TCP connections which are blocked via proxy automatically without a blacklist.")
)

s = m:section(TypedSection, "redsocks2_base", translate("Basic Settings"))
s.anonymous = true
o = s:option(Flag, "enabled", translate("Enable Redsocks2"))

o = s:option(ListValue, "loglevel", translate("Log Level"))
o:value("debug", translate("Verbose"))
o:value("info", translate("Normal"))
o:value("off", translate("Off"))

s = m:section(TypedSection, "redsocks2_redirect", translate("Redirector Settings"))
s.anonymous = true
s.addremove = true

o = s:option(Value, "local_ip", translate("Local IP"))
o.datatype = "ip4addr"

o = s:option(Value, "local_port", translate("Local Port"))
o.datatype = "uinteger"

o = s:option(Value, "ip", translate("Proxy Server IP"))
o.datatype = "ip4addr"

o = s:option(Value, "port", translate("Proxy Server Port"))
o.datatype = "uinteger"

o = s:option(ListValue, "proxy_type", translate("Proxy Server Type"))
o:value("shadowsocks", translate("Shadowsocks"))
o:value("socks5", translate("Socks5"))
o:value("direct", translate("Direct"))

o = s:option(ListValue, "enc_type", translate("Cipher Method"))
o:depends({proxy_type="shadowsocks"})
o:value("table")
o:value("rc4")
o:value("rc4-md5")
o:value("aes-128-cfb")
o:value("aes-192-cfb")
o:value("aes-256-cfb")
o:value("bf-cfb")
o:value("cast5-cfb")
o:value("des-cfb")
o:value("camellia-128-cfb")
o:value("camellia-192-cfb")
o:value("camellia-256-cfb")
o:value("idea-cfb")
o:value("rc2-cfb")
o:value("seed-cfb")

o = s:option(Value, "username", translate("Username"), translate("Leave empty if your proxy server doesn't need authentication."))
o:depends({proxy_type="socks5"})

o = s:option(Value, "password", translate("Password"))
o:depends({proxy_type="shadowsocks"})
o:depends({proxy_type="socks5"})
o.password = true

o = s:option(Value, "interface", translate("Outgoing interface"), translate("Outgoing interface for redsocks2."))
o:depends({proxy_type="direct"})

o = s:option(Flag, "autoproxy", translate("Enable Auto Proxy"))
o.rmempty = false

o = s:option(Value, "timeout", translate("Timeout"))
o:depends({autoproxy=1})
o.datatype = "uinteger"


s = m:section(TypedSection, "redsocks2_udprelay", translate("UDP Relay"))
s.anonymous = true
s.addremove = true

o = s:option(Value, "local_ip", translate("Local IP"))
o.datatype = "ip4addr"

o = s:option(Value, "local_port", translate("Local Port"))
o.datatype = "uinteger"

o = s:option(Value, "ip", translate("Proxy Server IP"))
o.datatype = "ip4addr"

o = s:option(Value, "port", translate("Proxy Server Port"))
o.datatype = "uinteger"

o = s:option(ListValue, "proxy_type", translate("Proxy Server Type"))
o:value("shadowsocks", translate("Shadowsocks"))
o:value("socks5", translate("Socks5"))
o:value("direct", translate("Direct"))

o = s:option(ListValue, "enc_type", translate("Cipher Method"))
o:depends({proxy_type="shadowsocks"})
o:value("table")
o:value("rc4")
o:value("rc4-md5")
o:value("aes-128-cfb")
o:value("aes-192-cfb")
o:value("aes-256-cfb")
o:value("bf-cfb")
o:value("cast5-cfb")
o:value("des-cfb")
o:value("camellia-128-cfb")
o:value("camellia-192-cfb")
o:value("camellia-256-cfb")
o:value("idea-cfb")
o:value("rc2-cfb")
o:value("seed-cfb")

o = s:option(Value, "username", translate("Username"), translate("Leave empty if your proxy server doesn't need authentication."))
o:depends({proxy_type="socks5"})

o = s:option(Value, "password", translate("Password"))
o:depends({proxy_type="shadowsocks"})
o:depends({proxy_type="socks5"})
o.password = true

o = s:option(Value, "interface", translate("Outgoing interface"), translate("Outgoing interface for redsocks2."))
o:depends({proxy_type="direct"})

o = s:option(Value, "udp_timeout", translate("UDP Timeout"))
o.datatype = "uinteger"

o = s:option(Value, "dest_ip", translate("Destination IP"))
o.datatype = "ip4addr"

o = s:option(Value, "dest_port", translate("Destination Port"))
o.datatype = "uinteger"

s = m:section(TypedSection, "redsocks2_iptables", translate("Iptables Redirect Settings"))
s.anonymous = true

o = s:option(Flag, "blacklist_enabled", translate("Enable Blacklist"), translate("Specify local IP addresses which won't be redirect to redsocks2."))
o.rmempty = false

o = s:option(Value, "ipset_blacklist", translate("Blacklist Path"))
o:depends({blacklist_enabled=1})

o = s:option(Flag, "whitelist_enabled", translate("Enable Whitelist"), translate("Specify destination IP addresses which won't be redirect to redsocks2."))
o.rmempty = false

o = s:option(Value, "ipset_whitelist", translate("Whitelist Path"))
o:depends({whitelist_enabled=1})

o = s:option(Value, "dest_port", translate("Destination Port"))
o.datatype = "uinteger"

return m
