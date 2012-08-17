--[[
LuCI - Lua Configuration Interface

Copyright 2011 Jo-Philipp Wich <xm@subsignal.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0
]]--

local map, section, net = ...
local ifc = net:get_interface()

local ipaddr, netmask, gateway, broadcast, dns, accept_ra, send_rs, ip6addr, ip6gw
local mtu, metric


ipaddr = section:taboption("general", Value, "ipaddr", translate("IPv4 address"))
ipaddr.datatype = "ip4addr"


netmask = section:taboption("general", Value, "netmask",
	translate("IPv4 netmask"))

netmask.datatype = "ip4addr"
netmask:value("255.255.255.0")
netmask:value("255.255.0.0")
netmask:value("255.0.0.0")


gateway = section:taboption("general", Value, "gateway", translate("IPv4 gateway"))
gateway.datatype = "ip4addr"


broadcast = section:taboption("general", Value, "broadcast", translate("IPv4 broadcast"))
broadcast.datatype = "ip4addr"


dns = section:taboption("general", DynamicList, "dns",
	translate("Use custom DNS servers"))

dns.datatype = "ipaddr"
dns.cast     = "string"


if luci.model.network:has_ipv6() then

	accept_ra = s:taboption("general", Flag, "accept_ra", translate("Accept router advertisements"))
	accept_ra.default = accept_ra.disabled


	send_rs = s:taboption("general", Flag, "send_rs", translate("Send router solicitations"))
	send_rs.default = send_rs.enabled
	send_rs:depends("accept_ra", "")


	ip6addr = section:taboption("general", Value, "ip6addr", translate("IPv6 address"))
	ip6addr.datatype = "ip6addr"
	ip6addr:depends("accept_ra", "")


	ip6gw = section:taboption("general", Value, "ip6gw", translate("IPv6 gateway"))
	ip6gw.datatype = "ip6addr"
	ip6gw:depends("accept_ra", "")

end


luci.tools.proto.opt_macaddr(section, ifc, translate("Override MAC address"))


mtu = section:taboption("advanced", Value, "mtu", translate("Override MTU"))
mtu.placeholder = "1500"
mtu.datatype    = "max(1500)"


metric = section:taboption("advanced", Value, "metric",
	translate("Use gateway metric"))

metric.placeholder = "0"
metric.datatype    = "uinteger"
