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

s = m:section(TypedSection, "route", "")
s.addremove = true
s.anonymous = true
s.template  = "cbi/tblsection"

iface = s:option(ListValue, "interface", translate("interface"))
luci.model.uci.foreach("network", "interface",
	function (section)
		if section[".name"] ~= "loopback" then
			iface:value(section[".name"])
		end
	end)

s:option(Value, "target", translate("target"), translate("a_n_r_target1"))

s:option(Value, "netmask", translate("netmask"), translate("a_n_r_netmask1")).rmemepty = true

s:option(Value, "gateway", translate("gateway"))

return m