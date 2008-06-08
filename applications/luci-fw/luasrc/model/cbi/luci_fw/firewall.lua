--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--
m = Map("luci_fw", translate("fw_fw", "Firewall"), translate("fw_fw1"))

s = m:section(TypedSection, "rule", "")
s.addremove = true
s.anonymous = true

chain = s:option(ListValue, "chain")
chain:value("forward", "Forward")
chain:value("input", "Input")
chain:value("output", "Output")
chain:value("prerouting", "Prerouting")
chain:value("postrouting", "Postrouting")

iface = s:option(ListValue, "iface")
iface.optional = true

oface = s:option(ListValue, "oface")
oface.optional = true

luci.model.uci.foreach("network", "interface",
	function (section)
		if section[".name"] ~= "loopback" then
			iface:value(section[".name"])
			oface:value(section[".name"])
		end
	end)

proto = s:option(ListValue, "proto", translate("protocol", "Protokoll"))
proto.optional = true
proto:value("")
proto:value("tcp", "TCP")
proto:value("udp", "UDP")

s:option(Value, "source").optional = true
s:option(Value, "destination").optional = true
s:option(Value, "mac").optional = true

sport = s:option(Value, "sport")
sport.optional = true
sport:depends("proto", "tcp")
sport:depends("proto", "udp")

dport = s:option(Value, "dport")
dport.optional = true
dport:depends("proto", "tcp")
dport:depends("proto", "udp")

tosrc = s:option(Value, "tosrc")
tosrc.optional = true
tosrc:depends("jump", "SNAT")

tosrc = s:option(Value, "todest")
tosrc.optional = true
tosrc:depends("jump", "DNAT")

jump = s:option(ListValue, "jump")
jump.rmempty = true
jump:value("", "")
jump:value("ACCEPT", translate("fw_accept"))
jump:value("REJECT", translate("fw_reject"))
jump:value("DROP", translate("fw_drop"))
jump:value("LOG", translate("fw_log"))
jump:value("DNAT", translate("fw_dnat"))
jump:value("MASQUERADE", translate("fw_masq"))
jump:value("SNAT", translate("fw_snat"))


add = s:option(Value, "command")
add.size = 50
add.rmempty = true

return m
