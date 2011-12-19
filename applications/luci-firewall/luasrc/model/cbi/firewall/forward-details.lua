--[[
LuCI - Lua Configuration Interface

Copyright 2011 Jo-Philipp Wich <xm@subsignal.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--

local sys = require "luci.sys"
local dsp = require "luci.dispatcher"

arg[1] = arg[1] or ""

m = Map("firewall",
	translate("Firewall - Port Forwards"),
	translate("This page allows you to change advanced properties of the port \
	           forwarding entry. In most cases there is no need to modify \
			   those settings."))

m.redirect = dsp.build_url("admin/network/firewall/forwards")

if m.uci:get("firewall", arg[1]) ~= "redirect" then
	luci.http.redirect(m.redirect)
	return
else
	local name = m:get(arg[1], "_name")
	if not name or #name == 0 then
		name = translate("(Unnamed Entry)")
	end
	m.title = "%s - %s" %{ translate("Firewall - Port Forwards"), name }
end

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

src = s:taboption("advanced", Value, "src", translate("Source zone"))
src.nocreate = true
src.default = "wan"
src.template = "cbi/firewall_zonelist"

proto = s:taboption("general", Value, "proto", translate("Protocol"))
proto.optional = true
proto:value("tcp udp", "TCP+UDP")
proto:value("tcp", "TCP")
proto:value("udp", "UDP")
proto:value("icmp", "ICMP")

function proto.cfgvalue(...)
	local v = Value.cfgvalue(...)
	if not v or v == "tcpudp" then
		return "tcp udp"
	end
	return v
end

dport = s:taboption("general", Value, "src_dport", translate("External port"),
	translate("Match incoming traffic directed at the given " ..
		"destination port or port range on this host"))
dport.datatype = "portrange"

to = s:taboption("general", Value, "dest_ip", translate("Internal IP address"),
	translate("Redirect matched incoming traffic to the specified " ..
		"internal host"))
to.datatype = "ip4addr"
for i, dataset in ipairs(sys.net.arptable()) do
	to:value(dataset["IP address"])
end

toport = s:taboption("general", Value, "dest_port", translate("Internal port (optional)"),
	translate("Redirect matched incoming traffic to the given port on " ..
		"the internal host"))
toport.optional = true
toport.placeholder = "0-65535"
toport.datatype = "portrange"

dest = s:taboption("advanced", Value, "dest", translate("Destination zone"))
dest.nocreate = true
dest.default = "lan"
dest.template = "cbi/firewall_zonelist"

src_dip = s:taboption("advanced", Value, "src_dip",
	translate("Intended destination address"),
	translate("Only match incoming traffic directed at the given IP address."))

src_dip.optional = true
src_dip.datatype = "ip4addr"
src_dip.placeholder = translate("any")

src_mac = s:taboption("advanced", DynamicList, "src_mac",
	translate("Source MAC address"),
	translate("Only match incoming traffic from these MACs."))
src_mac.optional = true
src_mac.datatype = "macaddr"
src_mac.placeholder = translate("any")

src_ip = s:taboption("advanced", Value, "src_ip",
	translate("Source IP address"),
	translate("Only match incoming traffic from this IP or range."))
src_ip.optional = true
src_ip.datatype = "neg(ip4addr)"
src_ip.placeholder = translate("any")

sport = s:taboption("advanced", Value, "src_port",
	translate("Source port"),
	translate("Only match incoming traffic originating from the given source port or port range on the client host"))
sport.optional = true
sport.datatype = "portrange"
sport.placeholder = translate("any")

reflection = s:taboption("advanced", Flag, "reflection", translate("Enable NAT Loopback"))
reflection.rmempty = true
reflection.default = reflection.enabled
reflection:depends({ target = "DNAT", src = wan_zone })
reflection.cfgvalue = function(...)
	return Flag.cfgvalue(...) or "1"
end

return m
