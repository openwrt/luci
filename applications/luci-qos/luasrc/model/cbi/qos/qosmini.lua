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

dl = s:option(Value, "download", translate("Downlink"), "kbit/s")
dl.datatype = "and(uinteger,min(1))"

ul = s:option(Value, "upload", translate("Uplink"), "kbit/s")
ul.datatype = "and(uinteger,min(1))"

s = m:section(TypedSection, "classify")
s.template = "cbi/tblsection"

s.anonymous = true
s.addremove = true
s.sortable  = true

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

local pats = io.popen("find /etc/l7-protocols/ -type f -name '*.pat'")
if pats then
	local l
	while true do
		l = pats:read("*l")
		if not l then break end

		l = l:match("([^/]+)%.pat$")
		if l then
			l7:value(l)
		end
	end
	pats:close()
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
