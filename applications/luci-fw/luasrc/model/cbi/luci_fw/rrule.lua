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

m = Map("firewall", translate("fw_redirect"), translate("fw_redirect_desc"))


s = m:section(NamedSection, arg[1], "redirect", "")
s.anonymous = true
s.addremove = false

back = s:option(DummyValue, "_overview", translate("overview"))
back.value = ""
back.titleref = luci.dispatcher.build_url("admin", "network", "firewall", "redirect")

name = s:option(Value, "_name", translate("name"))
name.rmempty = true
name.size = 10

iface = s:option(ListValue, "src", translate("fw_zone"))
iface.default = "wan"
luci.model.uci.cursor():foreach("firewall", "zone",
	function (section)
		iface:value(section.name)
	end)
	
s:option(Value, "src_ip", translate("firewall_redirect_srcip")).optional = true
s:option(Value, "src_mac", translate("firewall_redirect_srcmac")).optional = true

sport = s:option(Value, "src_port", translate("firewall_redirect_srcport"))
sport.optional = true
sport:depends("proto", "tcp")
sport:depends("proto", "udp")
sport:depends("proto", "tcpudp")

proto = s:option(ListValue, "proto", translate("protocol"))
proto.optional = true
proto:value("")
proto:value("tcp", "TCP")
proto:value("udp", "UDP")
proto:value("tcpudp", "TCP+UDP")

dport = s:option(Value, "src_dport", translate("firewall_redirect_srcdport"))
dport.size = 5
dport.optional = true
dport:depends("proto", "tcp")
dport:depends("proto", "udp")
dport:depends("proto", "tcpudp")

to = s:option(Value, "dest_ip", translate("firewall_redirect_destip"))
for i, dataset in ipairs(luci.sys.net.arptable()) do
	to:value(dataset["IP address"])
end

toport = s:option(Value, "dest_port", translate("firewall_redirect_destport"))
toport.optional = true
toport.size = 5

return m
