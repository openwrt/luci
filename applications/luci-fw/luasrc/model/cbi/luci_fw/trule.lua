--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--
arg[1] = arg[1] or ""
m = Map("firewall", translate("Advanced Rules"), translate("Advanced rules let you customize the firewall to your needs. Only new connections will be matched. Packets belonging to already open connections are automatically allowed to pass the firewall."))

s = m:section(NamedSection, arg[1], "rule", "")
s.anonymous = true
s.addremove = false

back = s:option(DummyValue, "_overview", translate("Overview"))
back.value = ""
back.titleref = luci.dispatcher.build_url("admin", "network", "firewall", "rule")


name = s:option(Value, "_name", translate("Name")..translate(" (optional)"))
name.rmempty = true

iface = s:option(ListValue, "src", translate("Source"))
iface.rmempty = true

oface = s:option(ListValue, "dest", translate("Destination"))
oface:value("", translate("Device"))
oface.rmempty = true

luci.model.uci.cursor():foreach("firewall", "zone",
	function (section)
		iface:value(section.name)
		oface:value(section.name)
	end)

proto = s:option(Value, "proto", translate("Protocol"))
proto.optional = true
proto:value("")
proto:value("tcpudp", "TCP+UDP")
proto:value("tcp", "TCP")
proto:value("udp", "UDP")
proto:value("icmp", "ICMP")

s:option(Value, "src_ip", translate("Source address")).optional = true
s:option(Value, "dest_ip", translate("Destination address")).optional = true
s:option(Value, "src_mac", translate("Source MAC-Address")).optional = true

sport = s:option(Value, "src_port", translate("Source port"))
sport:depends("proto", "tcp")
sport:depends("proto", "udp")
sport:depends("proto", "tcpudp")

dport = s:option(Value, "dest_port", translate("Destination port"))
dport:depends("proto", "tcp")
dport:depends("proto", "udp")
dport:depends("proto", "tcpudp")

jump = s:option(ListValue, "target", translate("Action"))
jump.rmempty = true
jump.default = "ACCEPT"
jump:value("DROP", translate("drop"))
jump:value("ACCEPT", translate("accept"))
jump:value("REJECT", translate("reject"))


return m
