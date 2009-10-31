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
m = Map("firewall", translate("Traffic Redirection"), translate("Traffic redirection allows you to change the destination address of forwarded packets."))


s = m:section(TypedSection, "redirect", "")
s.template  = "cbi/tblsection"
s.addremove = true
s.anonymous = true
s.extedit   = luci.dispatcher.build_url("admin", "network", "firewall", "redirect", "%s")

name = s:option(Value, "_name", translate("Name"), translate(" (optional)"))
name.size = 10

iface = s:option(ListValue, "src", translate("Zone"))
iface.default = "wan"
luci.model.uci.cursor():foreach("firewall", "zone",
	function (section)
		iface:value(section.name)
	end)

proto = s:option(ListValue, "proto", translate("Protocol"))
proto:value("tcp", "TCP")
proto:value("udp", "UDP")
proto:value("tcpudp", "TCP+UDP")

dport = s:option(Value, "src_dport")
dport.size = 5

to = s:option(Value, "dest_ip")
for i, dataset in ipairs(luci.sys.net.arptable()) do
	to:value(dataset["IP address"])
end

toport = s:option(Value, "dest_port")
toport.size = 5

return m
