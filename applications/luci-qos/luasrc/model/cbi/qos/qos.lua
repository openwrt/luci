--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--
require("luci.tools.webadmin")
m = Map("qos")

s = m:section(TypedSection, "interface", translate("interfaces"))
s.addremove = true

s:option(Flag, "enabled", translate("enable"))

c = s:option(ListValue, "classgroup")
c:value("Default", "standard")
c.default = "Default"

s:option(Flag, "overhead")

s:option(Flag, "halfduplex")

s:option(Value, "download", nil, "kb/s")

s:option(Value, "upload", nil, "kb/s")

s = m:section(TypedSection, "classify")
s.template = "cbi/tblsection"
s.anonymous = true
s.addremove = true

t = s:option(ListValue, "target")
t:value("Priority", translate("qos_priority"))
t:value("Express", translate("qos_express"))
t:value("Normal", translate("qos_normal"))
t:value("Bulk", translate("qos_bulk"))
t.default = "Normal"

srch = s:option(Value, "srchost")
srch.rmempty = true
srch:value("", translate("all"))
luci.tools.webadmin.cbi_add_knownips(srch)

dsth = s:option(Value, "dsthost")
dsth.rmempty = true
dsth:value("", translate("all"))
luci.tools.webadmin.cbi_add_knownips(dsth)

l7 = s:option(ListValue, "layer7", translate("service"))
l7.rmempty = true
l7:value("", translate("all"))
local pats = luci.fs.dir("/etc/l7-protocols")
if pats then
	for i,f in ipairs(pats) do
		if f:sub(-4) == ".pat" then
			l7:value(f:sub(1, #f-4))
		end
	end
end

p = s:option(Value, "proto", translate("protocol"))
p:value("", translate("all"))
p:value("tcp", "TCP")
p:value("udp", "UDP")
p:value("icmp", "ICMP")
p.rmempty = true

ports = s:option(Value, "ports", translate("ports"))
ports.rmempty = true
ports:value("", translate("allf", translate("all")))

bytes = s:option(Value, "connbytes", translate("qos_connbytes"))

return m
