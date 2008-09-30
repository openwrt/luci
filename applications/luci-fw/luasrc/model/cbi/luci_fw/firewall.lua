--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--
m = Map("firewall", translate("fw_rules"), translate("fw_rules1"))

s = m:section(TypedSection, "rule", "")
s.addremove = true
s.anonymous = true

iface = s:option(ListValue, "src")
iface.rmempty = true

oface = s:option(ListValue, "dest")
oface:value("")
oface.optional = true

luci.model.uci.cursor():foreach("firewall", "zone",
	function (section)
		iface:value(section.name)
		oface:value(section.name)
	end)

proto = s:option(ListValue, "proto", translate("protocol"))
proto.optional = true
proto:value("")
proto:value("tcpudp", "TCP+UDP")
proto:value("tcp", "TCP")
proto:value("udp", "UDP")
proto:value("icmp", "ICMP")

s:option(Value, "src_ip").optional = true
s:option(Value, "dest_ip").optional = true
s:option(Value, "src_mac").optional = true

sport = s:option(Value, "src_port")
sport.optional = true
sport:depends("proto", "tcp")
sport:depends("proto", "udp")
sport:depends("proto", "tcpudp")

dport = s:option(Value, "dest_port")
dport.optional = true
dport:depends("proto", "tcp")
dport:depends("proto", "udp")
dport:depends("proto", "tcpudp")

jump = s:option(ListValue, "target")
jump.rmempty = true
jump.default = "ACCEPT"
jump:value("DROP", translate("fw_drop"))
jump:value("ACCEPT", translate("fw_accept"))
jump:value("REJECT", translate("fw_reject"))


return m
