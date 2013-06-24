--[[
LuCI - Lua Configuration Interface

Copyright 2013 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

]]--

local m, s, o

m = Map("6relayd", translate("IPv6 RA and DHCPv6"),
	translate("6relayd is a lightweight router advertisement daemon and provides " ..
	 "stateless DHCPv6 service where size matters. It can also be used as a relay " ..
	 "for the aforementioned services."))

s = m:section(TypedSection, "server", translate("Server Settings"))
s.addremove = false
s.anonymous = true


o = s:option(DynamicList, "network", translate("Service Interfaces"),
	translate("Interfaces to provide services on or to relay services to."))
o.widget = "checkbox"
o.template = "cbi/network_netlist"
o.nocreate = true
o.nobridges = true
o.novirtual = true
o.optional = false

o = s:option(ListValue, "rd", translate("Router Advertisement-Service"))
o:value("", translate("disabled"))
o:value("server", translate("server mode"))
o:value("relay", translate("relay mode"))

o = s:option(ListValue, "dhcpv6", translate("DHCPv6-Service"))
o:value("", translate("disabled"))
o:value("server", translate("server mode"))
o:value("relay", translate("relay mode"))

o = s:option(ListValue, "ndp", translate("NDP-Proxy"))
o:value("", translate("disabled"))
o:value("relay", translate("relay mode"))

o = s:option(MultiValue, "fallback_relay", translate("Fallback to relay"),
	translate("Relay services from master to server interfaces when there is no public prefix available."))
o:value("rd", translate("Router Advertisement"))
o:value("dhcpv6", translate("DHCPV6"))
o:value("ndp", translate("NDP-Proxy"))

o = s:option(Value, "master", translate("Master Interface"),
	translate("Specifies the master interface for services that are relayed."))
o.template = "cbi/network_netlist"
o.nocreate = true
o:depends("rd", "relay")
o:depends("dhcpv6", "relay")
o:depends("ndp", "relay")
o:depends("fallback_relay", "rd")
o:depends("fallback_relay", "dhcpv6")
o:depends("fallback_relay", "ndp")

o = s:option(Flag, "always_rewrite_dns", translate("Always announce local DNS"),
	translate("Announce the local router as DNS server even in relay mode."))
o:depends("rd", "relay")
o:depends("dhcpv6", "relay")
o:depends("fallback_relay", "rd")
o:depends("fallback_relay", "dhcpv6")

o = s:option(Flag, "always_assume_default", translate("Always announce default router"),
	translate("Announce as default router even if no public prefix is available."))
o:depends("rd", "server")

return m
