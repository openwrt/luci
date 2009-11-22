--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--

m = Map("network", translate("Manage Traffic Routing"),
translate("With additional static routes you allow computers on your network to reach unannounced remote hosts or networks."))

local routes6 = luci.sys.net.routes6()
local bit = require "bit"

m:append(Template("niu/network/rtable"))

s = m:section(TypedSection, "route", "Static IPv4 Routes")
s.addremove = true
s.anonymous = true

s.template  = "cbi/tblsection"

iface1 = s:option(ListValue, "interface", translate("Interface"))

s:option(Value, "target", translate("Target"), translate("Host-<abbr title=\"Internet Protocol Address\">IP</abbr> or Network"))
s:option(Value, "netmask", translate("<abbr title=\"Internet Protocol Version 4\">IPv4</abbr>-Netmask"), translate("if target is a network")).rmemepty = true
s:option(Value, "gateway", translate("<abbr title=\"Internet Protocol Version 4\">IPv4</abbr>-Gateway"))

if routes6 then
	s = m:section(TypedSection, "route6", "Static IPv6 Routes")
	s.addremove = true
	s.anonymous = true

	s.template  = "cbi/tblsection"

	iface2 = s:option(ListValue, "interface", translate("Interface"))

	s:option(Value, "target", translate("Target"), translate("<abbr title=\"Internet Protocol Version 6\">IPv6</abbr>-Address or Network (CIDR)"))
	s:option(Value, "gateway", translate("<abbr title=\"Internet Protocol Version 6\">IPv6</abbr>-Gateway")).rmempty = true
end

m.uci:foreach("network", "interface", function(s)
	if s[".name"] ~= "loopback" then
		iface:value(s[".name"])
		if iface2 then
			iface2:value(s[".name"])
		end
	end
end)

return m
