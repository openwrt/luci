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

local has_v2 = nixio.fs.access("/lib/firewall/fw.sh")
local dsp = require "luci.dispatcher"

arg[1] = arg[1] or ""

m = Map("firewall", translate("Advanced Rules"),
	translate("Advanced rules let you customize the firewall to your " ..
		"needs. Only new connections will be matched. Packets " ..
		"belonging to already open connections are automatically " ..
		"allowed to pass the firewall."))

m.redirect = dsp.build_url("admin", "network", "firewall")

if not m.uci:get(arg[1]) == "rule" then
	luci.http.redirect(m.redirect)
	return
end

s = m:section(NamedSection, arg[1], "rule", "")
s.anonymous = true
s.addremove = false

s:tab("general", translate("General Settings"))
s:tab("advanced", translate("Advanced Options"))

back = s:option(DummyValue, "_overview", translate("Overview"))
back.value = ""
back.titleref = dsp.build_url("admin", "network", "firewall", "rule")


name = s:taboption("general", Value, "_name", translate("Name").." "..translate("(optional)"))
name.rmempty = true

src = s:taboption("general", Value, "src", translate("Source zone"))
src.nocreate = true
src.default = "wan"
src.template = "cbi/firewall_zonelist"

dest = s:taboption("advanced", Value, "dest", translate("Destination zone"))
dest.nocreate = true
dest.allowlocal = true
dest.template = "cbi/firewall_zonelist"

proto = s:taboption("general", Value, "proto", translate("Protocol"))
proto.optional = true
proto:value("all", translate("Any"))
proto:value("tcpudp", "TCP+UDP")
proto:value("tcp", "TCP")
proto:value("udp", "UDP")
proto:value("icmp", "ICMP")

icmpt = s:taboption("general", Value, "icmp_type", translate("Match ICMP type"))
icmpt:depends("proto", "icmp")
icmpt:value("", "any")
icmpt:value("echo-reply")
icmpt:value("destination-unreachable")
icmpt:value("network-unreachable")
icmpt:value("host-unreachable")
icmpt:value("protocol-unreachable")
icmpt:value("port-unreachable")
icmpt:value("fragmentation-needed")
icmpt:value("source-route-failed")
icmpt:value("network-unknown")
icmpt:value("host-unknown")
icmpt:value("network-prohibited")
icmpt:value("host-prohibited")
icmpt:value("TOS-network-unreachable")
icmpt:value("TOS-host-unreachable")
icmpt:value("communication-prohibited")
icmpt:value("host-precedence-violation")
icmpt:value("precedence-cutoff")
icmpt:value("source-quench")
icmpt:value("redirect")
icmpt:value("network-redirect")
icmpt:value("host-redirect")
icmpt:value("TOS-network-redirect")
icmpt:value("TOS-host-redirect")
icmpt:value("echo-request")
icmpt:value("router-advertisement")
icmpt:value("router-solicitation")
icmpt:value("time-exceeded")
icmpt:value("ttl-zero-during-transit")
icmpt:value("ttl-zero-during-reassembly")
icmpt:value("parameter-problem")
icmpt:value("ip-header-bad")
icmpt:value("required-option-missing")
icmpt:value("timestamp-request")
icmpt:value("timestamp-reply")
icmpt:value("address-mask-request")
icmpt:value("address-mask-reply")

src_ip = s:taboption("general", Value, "src_ip", translate("Source address"))
src_ip.optional = true
src_ip.datatype = has_v2 and "neg_ipaddr" or "neg_ip4addr"
src_ip.placeholder = translate("any")

sport = s:taboption("general", Value, "src_port", translate("Source port"))
sport.optional = true
sport.datatype = "portrange"
sport.placeholder = "0-65535"
sport:depends("proto", "tcp")
sport:depends("proto", "udp")
sport:depends("proto", "tcpudp")

dest_ip = s:taboption("general", Value, "dest_ip", translate("Destination address"))
dest_ip.optional = true
dest_ip.datatype = has_v2 and "neg_ipaddr" or "neg_ip4addr"
dest_ip.placeholder = translate("any")

dport = s:taboption("general", Value, "dest_port", translate("Destination port"))
dport.optional = true
dport.datatype = "portrange"
dport:depends("proto", "tcp")
dport:depends("proto", "udp")
dport:depends("proto", "tcpudp")
dport.placeholder = "0-65535"

jump = s:taboption("general", ListValue, "target", translate("Action"))
jump.rmempty = true
jump.default = "ACCEPT"
jump:value("DROP", translate("drop"))
jump:value("ACCEPT", translate("accept"))
jump:value("REJECT", translate("reject"))
jump:value("NOTRACK", translate("don't track"))


smac = s:taboption("advanced", Value, "src_mac", translate("Source MAC address"))
smac.optional = true
smac.datatype = "macaddr"
smac.placeholder = translate("any")

if has_v2 then
	family = s:taboption("advanced", ListValue, "family", translate("Restrict to address family"))
	family.rmempty = true
	family:value("", translate("IPv4 and IPv6"))
	family:value("ipv4", translate("IPv4 only"))
	family:value("ipv6", translate("IPv6 only"))
end

return m
