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

local niulib = require "luci.niulib"
local fs = require "nixio.fs"
local has_ipv6 = fs.access("/proc/net/ipv6_route")

m = Map("network", "Configure Local Network", "These settings affect the devices in your local network. "..
"Usually you do not need to change anything here for your router to work correctly.")

s = m:section(NamedSection, "lan", "interface", "Network Settings")
s.addremove = false

s:tab("general", translate("General Settings"))

ipaddr = s:taboption("general", Value, "ipaddr", translate("<abbr title=\"Internet Protocol Version 4\">IPv4</abbr>-Address"))
ipaddr.default = "192.168.0.1"
ipaddr:depends("proto", "static")

nm = s:taboption("general", Value, "netmask", translate("<abbr title=\"Internet Protocol Version 4\">IPv4</abbr>-Netmask"))
nm.default = "255.255.255.0"
nm:value("255.255.255.0")
nm:value("255.255.0.0")
nm:value("255.0.0.0")
nm:depends("proto", "static")



s:tab("expert", translate("Expert Settings"))

p = s:taboption("expert", ListValue, "proto", translate("Connection Protocol"))
p.default = "static"
p:value("dhcp", "DHCP")
p:value("static", translate("Static Ethernet"))

mac = s:taboption("expert", Value, "macaddr", translate("<abbr title=\"Media Access Control\">MAC</abbr>-Address"))

mtu = s:taboption("expert", Value, "mtu", "MTU")
mtu.isinteger = true

dns = s:taboption("expert", Value, "dns", translate("<abbr title=\"Domain Name System\">DNS</abbr>-Server"))
dns:depends("peerdns", "")


gw = s:taboption("expert", Value, "gateway", translate("<abbr title=\"Internet Protocol Version 4\">IPv4</abbr>-Gateway"))
gw:depends("proto", "static")

bcast = s:taboption("expert", Value, "bcast", translate("<abbr title=\"Internet Protocol Version 4\">IPv4</abbr>-Broadcast"))
bcast:depends("proto", "static")


if has_ipv6 then
	ip6addr = s:taboption("expert", Value, "ip6addr", translate("<abbr title=\"Internet Protocol Version 6\">IPv6</abbr>-Address"), translate("<abbr title=\"Classless Inter-Domain Routing\">CIDR</abbr>-Notation: address/prefix"))
	ip6addr:depends("proto", "static")
	ip6gw = s:taboption("expert", Value, "ip6gw", translate("<abbr title=\"Internet Protocol Version 6\">IPv6</abbr>-Gateway"))
	ip6gw:depends("proto", "static")
end

emerg = s:taboption("expert", Value, "_emergv4", translate("Emergency Access Address"))
emerg:depends("proto", "dhcp")
emerg.default = "169.254.255.169"


stp = s:taboption("expert", Flag, "stp", translate("Enable <abbr title=\"Spanning Tree Protocol\">STP</abbr>"),
	translate("Enables the Spanning Tree Protocol on this bridge"))

ifname_multi = s:taboption("expert", MultiValue, "ifname", translate("Interface"))
ifname_multi.widget = "checkbox"
for _, eth in ipairs(niulib.eth_get_available("lan")) do
	ifname_multi:value(eth, translate("Ethernet-Adapter (%s)") % eth)
end



m2 = Map("dhcp")

s = m2:section(TypedSection, "dhcp", "DHCP")
s.anonymous = true
s.addremove = false
s.dynamic = false

s:tab("general", translate("General Settings"))

s:depends("interface", "lan")

enable = s:taboption("general", ListValue, "ignore", "Automatic address assignment for network devices", "")
enable:value(0, translate("enable"), {["network.lan.proto"] = "static"})
enable:value(1, translate("disable"))


s:tab("expert", translate("Expert Settings"))
start = s:taboption("expert", Value, "start", translate("First leased address"))
start:depends("ignore", "0")

limit = s:taboption("expert", Value, "limit", translate("Number of leased addresses"), "")
limit:depends("ignore", "0")

time = s:taboption("expert", Value, "leasetime", "Lease Time")
time:depends("ignore", "0")

local dd = s:taboption("expert", Flag, "dynamicdhcp", "Also generate addresses for unknown devices")
dd.rmempty = false
dd.default = "1"
dd:depends("ignore", "0")


return m, m2
