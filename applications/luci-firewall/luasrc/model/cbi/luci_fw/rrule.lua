--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>
Copyright 2010 Jo-Philipp Wich <xm@subsignal.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--

local sys = require "luci.sys"
local dsp = require "luci.dispatcher"

arg[1] = arg[1] or ""

m = Map("firewall", translate("Traffic Redirection"),
	translate("Traffic redirection allows you to change the " ..
		"destination address of forwarded packets."))

m.redirect = dsp.build_url("admin", "network", "firewall")

if not m.uci:get(arg[1]) == "redirect" then
	luci.http.redirect(m.redirect)
	return
end

local has_v2 = nixio.fs.access("/lib/firewall/fw.sh")
local wan_zone = nil

m.uci:foreach("firewall", "zone",
	function(s)
		local n = s.network or s.name
		if n then
			local i
			for i in n:gmatch("%S+") do
				if i == "wan" then
					wan_zone = s.name
					return false
				end
			end
		end
	end)

s = m:section(NamedSection, arg[1], "redirect", "")
s.anonymous = true
s.addremove = false

s:tab("general", translate("General Settings"))
s:tab("advanced", translate("Advanced Settings"))

name = s:taboption("general", Value, "_name", translate("Name"))
name.rmempty = true
name.size = 10

src = s:taboption("general", Value, "src", translate("Source zone"))
src.nocreate = true
src.default = "wan"
src.template = "cbi/firewall_zonelist"

proto = s:taboption("general", Value, "proto", translate("Protocol"))
proto.optional = true
proto:value("tcpudp", "TCP+UDP")
proto:value("tcp", "TCP")
proto:value("udp", "UDP")

dport = s:taboption("general", Value, "src_dport", translate("External port"),
	translate("Match incoming traffic directed at the given " ..
		"destination port or port range on this host"))
dport.datatype = "portrange"
dport:depends("proto", "tcp")
dport:depends("proto", "udp")
dport:depends("proto", "tcpudp")

to = s:taboption("general", Value, "dest_ip", translate("Internal IP address"),
	translate("Redirect matched incoming traffic to the specified " ..
		"internal host"))
to.datatype = "ip4addr"
for i, dataset in ipairs(luci.sys.net.arptable()) do
	to:value(dataset["IP address"])
end

toport = s:taboption("general", Value, "dest_port", translate("Internal port (optional)"),
	translate("Redirect matched incoming traffic to the given port on " ..
		"the internal host"))
toport.optional = true
toport.placeholder = "0-65535"
toport.datatype = "portrange"
toport:depends("proto", "tcp")
toport:depends("proto", "udp")
toport:depends("proto", "tcpudp")

target = s:taboption("advanced", ListValue, "target", translate("Redirection type"))
target:value("DNAT")
target:value("SNAT")

dest = s:taboption("advanced", Value, "dest", translate("Destination zone"))
dest.nocreate = true
dest.default = "lan"
dest.template = "cbi/firewall_zonelist"

src_dip = s:taboption("advanced", Value, "src_dip",
	translate("Intended destination address"),
	translate(
		"For DNAT, match incoming traffic directed at the given destination "..
		"ip address. For SNAT rewrite the source address to the given address."
	))

src_dip.optional = true
src_dip.datatype = "ip4addr"
src_dip.placeholder = translate("any")

src_mac = s:taboption("advanced", Value, "src_mac", translate("Source MAC address"))
src_mac.optional = true
src_mac.datatype = "macaddr"
src_mac.placeholder = translate("any")

src_ip = s:taboption("advanced", Value, "src_ip", translate("Source IP address"))
src_ip.optional = true
src_ip.datatype = "ip4addr"
src_ip.placeholder = translate("any")

sport = s:taboption("advanced", Value, "src_port", translate("Source port"),
	translate("Match incoming traffic originating from the given " ..
		"source port or port range on the client host"))
sport.optional = true
sport.datatype = "portrange"
sport.placeholder = "0-65536"
sport:depends("proto", "tcp")
sport:depends("proto", "udp")
sport:depends("proto", "tcpudp")

reflection = s:taboption("advanced", Flag, "reflection", translate("Enable NAT Loopback"))
reflection.rmempty = true
reflection:depends({ target = "DNAT", src = wan_zone })
reflection.cfgvalue = function(...)
	return Flag.cfgvalue(...) or "1"
end

return m
