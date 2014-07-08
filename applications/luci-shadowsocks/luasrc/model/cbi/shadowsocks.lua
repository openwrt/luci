--[[
LuCI - Lua Configuration Interface - miniDLNA support

Copyright 2012 Gabor Juhos <juhosg@openwrt.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--

local m, s, o

m = Map("shadowsocks", translate("ShadowSocks"),
	translate("ShadowSocks is server software help you access internet through GFW."))

--m:section(SimpleSection).template  = "minidlna_status"

s = m:section(TypedSection, "shadowsocks", "ShadowSocks Settings")
s.addremove = false
s.anonymous = true

s:tab("general", translate("General Settings"))
s:tab("advanced", translate("Advanced Settings"))

o = s:taboption("general", Flag, "enabled", translate("Enable:"), translate("Depends on shadowsocks package."))
o.rmempty=false

function o.write(self, section, value)
	if value == "1" then
		luci.sys.init.enable("luci-shadowsocks")
		luci.sys.call("/etc/init.d/luci-shadowsocks start >/dev/null")
	else
		luci.sys.call("/etc/init.d/luci-shadowsocks stop >/dev/null")
		luci.sys.init.disable("luci-shadowsocks")
	end

	return Flag.write(self, section, value)
end

o = s:taboption("general", Flag, "redir", translate("Redirect non-China traffic:"),
	translate("Redirect non-China traffic to shadowsocks. Otherwise clients need to be configured to use socks5 proxy. Depends on iptables-mod-geoip, iptables-mod-nat-extra package."))
o:depends("enabled", 1)

o = s:taboption("general", Flag, "cleandns", translate("Clean DNS pollution:"),
	translate("Clean DNS pollution for domains like Facebook, Youtube. It's only useful in Redirect mode. Maybe it will impact the performance accessing China sites deployed with CDN. Depends on iptables-mod-u32 package."))
o:depends("enabled", 1)

o = s:taboption("general", Value, "server", translate("Server:"),
	translate("Hostname or IP address of shadowsocks server."))
o.rmempty=true
o.placeholder = "0.0.0.0"

o = s:taboption("general", Value, "server_port", translate("Server Port:"),
	translate("Port of shadowsocks server."))
o.datatype = "port"
o.rmempty = true
o.placeholder = 8388

o = s:taboption("general", Value, "local_port", translate("Local Port:"),
	translate("Local socks5 proxy port of shadowsocks client. Clients use this port in non-redirect mode. It's not useful in redrect mode."))
o.datatype = "port"
o.rmempty = true
o.placeholder = 1080

o = s:taboption("general", Value, "password", translate("Password:"),
	translate("Password of shadowsocks server."))
--o.password = true

o = s:taboption("general", ListValue, "method", translate("Method:"),
	translate("Encryption method of shadowsocks server."))
o.default="aes-256-cfb"
o:value("table")
o:value("rc4")
o:value("aes-128-cfb")
o:value("aes-192-cfb")
o:value("aes-256-cfb")
o:value("bf-cfb")
o:value("camellia-128-cfb")
o:value("camellia-192-cfb")
o:value("camellia-256-cfb")
o:value("cast5-cfb")
o:value("des-cfb")
o:value("idea-cfb")
o:value("rc2-cfb")
o:value("seed-cfb")

o = s:taboption("general", Value, "timeout", translate("Timeout(seconds):"),
	translate("Socket timeout in seconds"))
o.datatype = "uinteger"
o.default = "600"

o = s:taboption("advanced", DynamicList, "whitelist", translate("Whitelist IPs:"),
	translate("This is a list of non-China IPs to bypass shadowsocks. (Useful when Redirect non-China traffic is enabled)"))
o.rmempty = true
o.placeholder = "0.0.0.0"

function o.cfgvalue(self, section)
	local rv = { }

	local val = Value.cfgvalue(self, section)
	if type(val) == "table" then
		val = table.concat(val, "/")
	elseif not val then
		val = ""
	end

	local file
	for file in val:gmatch("[^/%s]+") do
		rv[#rv+1] = file
	end

	return rv
end

function o.write(self, section, value)
	local rv = { }
	local file
	for file in luci.util.imatch(value) do
		rv[#rv+1] = file
	end
	Value.write(self, section, table.concat(rv, "/"))
end

o = s:taboption("advanced", DynamicList, "dns_blacklist", translate("Additional IPs for polluted hostnames:"),
	translate("This is a list of additional IPs return by GFW for polluted hostnames. Most of these IPs have been configured by default."))
o.rmempty = true
o.placeholder = "0.0.0.0"

function o.cfgvalue(self, section)
	local rv = { }

	local val = Value.cfgvalue(self, section)
	if type(val) == "table" then
		val = table.concat(val, "/")
	elseif not val then
		val = ""
	end

	local file
	for file in val:gmatch("[^/%s]+") do
		rv[#rv+1] = file
	end

	return rv
end

function o.write(self, section, value)
	local rv = { }
	local file
	for file in luci.util.imatch(value) do
		rv[#rv+1] = file
	end
	Value.write(self, section, table.concat(rv, "/"))
end

return m
