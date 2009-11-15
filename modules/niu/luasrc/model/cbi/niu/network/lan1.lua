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

m = Map("network", "Configure Local Network", "These settings affect the devices in your local network. "..
"Usually you do not need to change anything here for your router to work correctly.")

nw.init(m.uci)

s = m:section(NamedSection, "lan", "interface", "Network Settings")
s.addremove = false

s:tab("general", translate("General Settings"))

ipaddr = s:taboption("general", Value, "ipaddr", translate("<abbr title=\"Internet Protocol Version 4\">IPv4</abbr>-Address"))

nm = s:taboption("general", Value, "netmask", translate("<abbr title=\"Internet Protocol Version 4\">IPv4</abbr>-Netmask"))
nm:value("255.255.255.0")
nm:value("255.255.0.0")
nm:value("255.0.0.0")



s:tab("expert", translate("Expert Settings"))

mac = s:taboption("expert", Value, "macaddr", translate("<abbr title=\"Media Access Control\">MAC</abbr>-Address"))

mtu = s:taboption("expert", Value, "mtu", "MTU")
mtu.isinteger = true

dns = s:taboption("expert", Value, "dns", translate("<abbr title=\"Domain Name System\">DNS</abbr>-Server"))
dns:depends("peerdns", "")


gw = s:taboption("expert", Value, "gateway", translate("<abbr title=\"Internet Protocol Version 4\">IPv4</abbr>-Gateway"))
bcast = s:taboption("expert", Value, "bcast", translate("<abbr title=\"Internet Protocol Version 4\">IPv4</abbr>-Broadcast"))


if has_ipv6 then
	ip6addr = s:taboption("expert", Value, "ip6addr", translate("<abbr title=\"Internet Protocol Version 6\">IPv6</abbr>-Address"), translate("<abbr title=\"Classless Inter-Domain Routing\">CIDR</abbr>-Notation: address/prefix"))
	ip6gw = s:taboption("expert", Value, "ip6gw", translate("<abbr title=\"Internet Protocol Version 6\">IPv6</abbr>-Gateway"))
end


stp = s:taboption("expert", Flag, "stp", translate("Enable <abbr title=\"Spanning Tree Protocol\">STP</abbr>"),
	translate("Enables the Spanning Tree Protocol on this bridge"))

ifname_multi = s:taboption("expert", MultiValue, "ifname_multi", translate("Interface"))
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


m2 = Map("dhcp")

s = m2:section(TypedSection, "dhcp", "DHCP")
s.anonymous = true
s.addremove = false
s.dynamic = false

s:tab("general", translate("General Settings"))

s:depends("interface", "lan")

enable = s:taboption("general", ListValue, "ignore", "Automatic address assignment for network devices", "")
enable:value(0, translate("enable"))
enable:value(1, translate("disable"))


s:tab("expert", translate("Expert Settings"))
start = s:taboption("expert", Value, "start", translate("First leased address"))
limit = s:taboption("expert", Value, "limit", translate("Number of leased addresses"), "")
time = s:taboption("expert", Value, "leasetime", "Lease Time")
local dd = s:taboption("expert", Flag, "dynamicdhcp", "Also generate addresses for unknown devices")
dd.rmempty = false
dd.default = "1"


return m, m2
