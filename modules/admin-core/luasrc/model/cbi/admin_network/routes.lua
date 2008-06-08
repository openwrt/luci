--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--
m = Map("network", "Statische Routen", [[Statische Routen geben an,
über welche Schnittstelle und welches Gateway ein bestimmter Host
oder ein bestimmtes Netzwerk erreicht werden kann.]])

s = m:section(TypedSection, "route", "")
s.addremove = true
s.anonymous = true
s.template  = "cbi/tblsection"

iface = s:option(ListValue, "interface", "Schnittstelle")
luci.model.uci.foreach("network", "interface",
	function (section)
		if section[".name"] ~= "loopback" then
			iface:value(section[".name"])
		end
	end)

s:option(Value, "target", "Ziel", "Host-IP oder Netzwerk")

s:option(Value, "netmask", "Netzmaske", "falls Ziel ein Netzwerk ist").rmemepty = true

s:option(Value, "gateway", "Gateway")

return m