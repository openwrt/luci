--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--

m = Map("network", translate("a_n_routes"), translate("a_n_routes1"))

local routes6 = luci.sys.net.routes6()
local bit = require "bit"

s = m:section(TypedSection, "route", translate("a_n_routes_static4"))
s.addremove = true
s.anonymous = true

s.template  = "cbi/tblsection"

iface1 = s:option(ListValue, "interface", translate("interface"))

s:option(Value, "target", translate("target"), translate("a_n_r_target1"))
s:option(Value, "netmask", translate("netmask"), translate("a_n_r_netmask1")).rmemepty = true
s:option(Value, "gateway", translate("gateway"))

if routes6 then
	s = m:section(TypedSection, "route6", translate("a_n_routes_static6"))
	s.addremove = true
	s.anonymous = true

	s.template  = "cbi/tblsection"

	iface2 = s:option(ListValue, "interface", translate("interface"))

	s:option(Value, "target", translate("target"), translate("a_n_r_target6"))
	s:option(Value, "gateway", translate("gateway6")).rmempty = true
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
