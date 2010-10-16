--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--
require("luci.sys")
arg[1] = arg[1] or ""

m = Map("firewall", translate("Traffic Redirection"),
	translate("Traffic redirection allows you to change the " ..
		"destination address of forwarded packets."))


s = m:section(NamedSection, arg[1], "redirect", "")
s.anonymous = true
s.addremove = false

back = s:option(DummyValue, "_overview", translate("Overview"))
back.value = ""
back.titleref = luci.dispatcher.build_url("admin", "network", "firewall", "redirect")

name = s:option(Value, "_name", translate("Name"))
name.rmempty = true
name.size = 10

iface = s:option(ListValue, "src", translate("Source zone"))
iface.default = "wan"
luci.model.uci.cursor():foreach("firewall", "zone",
	function (section)
		iface:value(section.name)
	end)
	
s:option(Value, "src_ip", translate("Source IP address")).optional = true
s:option(Value, "src_mac", translate("Source MAC-address")).optional = true

sport = s:option(Value, "src_port", translate("Source port"),
	translate("Match incoming traffic originating from the given " ..
		"source port or port range on the client host"))
sport.optional = true
sport:depends("proto", "tcp")
sport:depends("proto", "udp")
sport:depends("proto", "tcpudp")

proto = s:option(ListValue, "proto", translate("Protocol"))
proto.optional = true
proto:value("")
proto:value("tcp", "TCP")
proto:value("udp", "UDP")
proto:value("tcpudp", "TCP+UDP")

dport = s:option(Value, "src_dport", translate("External port"),
	translate("Match incoming traffic directed at the given " ..
		"destination port or port range on this host"))
dport.size = 5
dport:depends("proto", "tcp")
dport:depends("proto", "udp")
dport:depends("proto", "tcpudp")

to = s:option(Value, "dest_ip", translate("Internal IP address"),
	translate("Redirect matched incoming traffic to the specified " ..
		"internal host"))
for i, dataset in ipairs(luci.sys.net.arptable()) do
	to:value(dataset["IP address"])
end

toport = s:option(Value, "dest_port", translate("Internal port (optional)"),
	translate("Redirect matched incoming traffic to the given port on " ..
		"the internal host"))
toport.optional = true
toport.size = 5

return m
