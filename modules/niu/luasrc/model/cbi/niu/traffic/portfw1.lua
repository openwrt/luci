--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--
local fs = require "nixio.fs"
local sys = require "luci.sys"

m = Map("firewall", translate("Manage Port Forwarding"))

s = m:section(TypedSection, "redirect", translate("Manual Port Forwarding"), 
translate([[To manually define a forwarding rule you have to specify at least
the internal IP-address and port of the service that should be forwarded.
If you ommit the external port it will be the same as the internal port.
You also can forward a range of ports by using the syntax first-last Port
(e.g. 1024-1030) in the port field.]]))
s.template  = "cbi/tblsection"
s.addremove = true
s.anonymous = true

name = s:option(Value, "_name", translate("Name"), translate("optional"))
name.size = 10

iface = s:option(ListValue, "src", translate("Zone"))
iface:value("wan", "Internet")
iface.default = "wan"

proto = s:option(ListValue, "proto", translate("Protocol"))
proto:value("tcp", "TCP")
proto:value("udp", "UDP")
proto:value("tcpudp", "TCP+UDP")

dport = s:option(Value, "src_dport", translate("Internal Port"))
dport.size = 5

to = s:option(Value, "dest_ip", translate("Internal Address"), translate("Device running the service"))
for i, dataset in ipairs(sys.net.arptable()) do
	to:value(dataset["IP address"])
end

toport = s:option(Value, "dest_port", translate("External Port"), translate("optional"));
toport.size = 5

local m2
if fs.access("/etc/config/upnpd") then
	m2 = Map("upnpd")
	s = m2:section(NamedSection, "config", "upnpd", translate("Automatic Port Forwarding (UPnP IGD)"),
	translate([[Allows UPnP-capable applications to automatically forward ports on the router to their IP-Address.
	Be aware that this is a potential security risk as applications are not authenticated.]]))
	s.addremove = false
	
	on = s:option(ListValue, "external_iface", translate("Port Forwarding Restrictions"))
	on:value("none", translate("Manual Forwarding Only")) 
	on:value("wan", translate("Automatic and Manual Forwarding"))
end

return m, m2
