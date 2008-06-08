--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--
m = Map("luci_fw", translate("fw_routing", "Routing"), translate("fw_routing1"))

s = m:section(TypedSection, "routing", "")
s.template  = "cbi/tblsection"
s.addremove = true
s.anonymous = true

iface = s:option(ListValue, "iface")
oface = s:option(ListValue, "oface")

luci.model.uci.foreach("network", "interface",
	function (section)
		if section[".name"] ~= "loopback" then
			iface:value(section[".name"])
			oface:value(section[".name"])
		end
	end)

s:option(Flag, "fwd", "FWD").rmempty = true
s:option(Flag, "nat", "NAT").rmempty = true
s:option(Flag, "bidi", "<->").rmempty = true

return m
