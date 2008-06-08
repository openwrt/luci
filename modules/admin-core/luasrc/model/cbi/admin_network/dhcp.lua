--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--
require("luci.model.uci")
require("luci.sys")

m = Map("dhcp", "DHCP")

s = m:section(TypedSection, "dhcp", "")
s.addremove = true
s.anonymous = true

iface = s:option(ListValue, "interface", translate("interface", "Schnittstelle"))
luci.model.uci.foreach("network", "interface",
	function (section)
		if section[".name"] ~= "loopback" then
			iface:value(section[".name"])
			s:depends("interface", section[".name"])
		end
	end)

s:option(Value, "start", translate("start", "Start"), "Erste vergebene Adresse (letztes Oktett)").rmempty = true

s:option(Value, "limit", translate("limit", "Limit"), "Anzahl zu vergebender Adressen -1").rmempty = true

s:option(Value, "leasetime").rmempty = true

s:option(Flag, "dynamicdhcp").rmempty = true

s:option(Value, "name", translate("name", "Name")).optional = true

s:option(Flag, "ignore").optional = true

s:option(Value, "netmask", translate("netmask", "Netzmaske")).optional = true

s:option(Flag, "force").optional = true

for i, line in pairs(luci.sys.execl("dnsmasq --help dhcp")) do
	k, v = line:match("([^ ]+) +([^ ]+)")
	s:option(Value, "dhcp"..k, v).optional = true
end
	
return m