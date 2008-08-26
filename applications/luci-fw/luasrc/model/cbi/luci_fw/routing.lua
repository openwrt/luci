--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--
m = Map("firewall", translate("fw_forwarding"), translate("fw_forwarding1"))

s = m:section(TypedSection, "forwarding", "")
s.template  = "cbi/tblsection"
s.addremove = true
s.anonymous = true

iface = s:option(ListValue, "src")
oface = s:option(ListValue, "dest")

luci.model.uci.cursor():foreach("firewall", "zone",
	function (section)
			iface:value(section.name)
			oface:value(section.name)
	end)

return m
