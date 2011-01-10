--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>
Copyright 2008 Jo-Philipp Wich <xm@leipzig.freifunk.net>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--

local wa = require "luci.tools.webadmin"
local fs = require "nixio.fs"

m = Map("qos")

s = m:section(NamedSection, "wan", "interface", translate("Internet Connection"))

s:option(Flag, "enabled", translate("Quality of Service"))
s:option(Value, "download", translate("Downlink"), "kb/s")
s:option(Value, "upload", translate("Uplink"), "kb/s")

s = m:section(TypedSection, "classify")
s.template = "cbi/tblsection"

s.anonymous = true
s.addremove = true

t = s:option(ListValue, "target")
t:value("Priority", translate("priority"))
t:value("Express", translate("express"))
t:value("Normal", translate("normal"))
t:value("Bulk", translate("low"))
t.default = "Normal"

srch = s:option(Value, "srchost")
srch.rmempty = true
srch:value("", translate("all"))
wa.cbi_add_knownips(srch)

dsth = s:option(Value, "dsthost")
dsth.rmempty = true
dsth:value("", translate("all"))
wa.cbi_add_knownips(dsth)

l7 = s:option(ListValue, "layer7", translate("Service"))
l7.rmempty = true
l7:value("", translate("all"))
local pats = fs.glob("/etc/l7-protocols/*/*.pat")
if pats then
	for f in pats do
		f = f:match("([^/]+)%.pat$")
		if f then
			l7:value(f)
		end
	end
end

p = s:option(ListValue, "proto", translate("Protocol"))
p:value("", translate("all"))
p:value("tcp", "TCP")
p:value("udp", "UDP")
p:value("icmp", "ICMP")
p.rmempty = true

ports = s:option(Value, "ports", translate("Ports"))
ports.rmempty = true
ports:value("", translate("allf", translate("all")))

bytes = s:option(Value, "connbytes", translate("qos_connbytes"))

return m
