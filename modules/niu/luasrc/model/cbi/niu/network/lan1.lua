--[[
LuCI - Lua Configuration Interface

Copyright 2009 Steven Barth <steven@midlink.org>
Copyright 2009 Jo-Philipp Wich <xm@subsignal.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--

local nw = require "luci.model.network"

local has_ipv6 = nw:has_ipv6()

m = Map("network", translate("m_n_lan"))

nw.init(m.uci)

s = m:section(NamedSection, "lan", "interface")
s.addremove = false

s:tab("general", translate("niu_general", "General Settings"))

ipaddr = s:taboption("general", Value, "ipaddr", translate("ipaddress"))

nm = s:taboption("general", Value, "netmask", translate("netmask"))
nm:value("255.255.255.0")
nm:value("255.255.0.0")
nm:value("255.0.0.0")



s:tab("expert", translate("niu_expert", "Expert Settings"))

mac = s:taboption("expert", Value, "macaddr", translate("macaddress"))

mtu = s:taboption("expert", Value, "mtu", "MTU")
mtu.isinteger = true

dns = s:taboption("expert", Value, "dns", translate("dnsserver"))
dns:depends("peerdns", "")


gw = s:taboption("expert", Value, "gateway", translate("gateway"))
bcast = s:taboption("expert", Value, "bcast", translate("broadcast"))


if has_ipv6 then
	ip6addr = s:taboption("expert", Value, "ip6addr", translate("ip6address"), translate("cidr6"))
	ip6gw = s:taboption("expert", Value, "ip6gw", translate("gateway6"))
end


stp = s:taboption("expert", Flag, "stp", translate("a_n_i_stp"),
	translate("a_n_i_stp1", "Enables the Spanning Tree Protocol on this bridge"))

ifname_multi = s:taboption("expert", MultiValue, "ifname_multi", translate("interface"))
ifname_multi.template = "cbi/network_ifacelist"
ifname_multi.nobridges = true
ifname_multi.widget = "checkbox"

function ifname_multi.cfgvalue(self, s)
	return self.map.uci:get("network", s, "ifname")
end

function ifname_multi.write(self, s, val)
	local n = nw:get_network(s)
	if n then n:ifname(val) end
end

for _, d in ipairs(nw:get_interfaces()) do
	if not d:is_bridge() then
		ifname_multi:value(d:name())
	end
end


m2 = Map("dhcp", "DHCP")

s = m2:section(TypedSection, "dhcp", "DHCP-Server")
s.anonymous = true
s.addremove = false
s.dynamic = false

s:tab("general", translate("niu_general", "General Settings"))

s:depends("interface", "lan")

enable = s:taboption("general", ListValue, "ignore", translate("enable"), "")
enable:value(0, translate("enable"))
enable:value(1, translate("disable"))


s:tab("expert", translate("niu_expert", "Expert Settings"))
start = s:taboption("expert", Value, "start", translate("m_n_d_firstaddress"))
limit = s:taboption("expert", Value, "limit", translate("m_n_d_numleases"), "")
time = s:taboption("expert", Value, "leasetime")


return m, m2
