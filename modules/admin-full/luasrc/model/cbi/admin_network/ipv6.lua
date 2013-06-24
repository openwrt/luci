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
	translate("6relayd is a daemon for serving and relaying IPv6 management protocols to "..
	"configure clients and downstream routers. "..
	"It provides server services for RA, stateless and stateful DHCPv6, "..
	"prefix delegation and can be used to relay RA, DHCPv6 and NDP between routed "..
	"(non-bridged) interfaces in case no delegated prefixes are available."))

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

o = s:option(ListValue, "management_level", translate("DHCPv6-Mode"))
o:value("", translate("stateless"))
o:value("1", translate("stateless + stateful"))
o:value("2", translate("stateful-only"))
o:depends("dhcpv6", "server")

o = s:option(ListValue, "ndp", translate("NDP-Proxy"))
o:value("", translate("disabled"))
o:value("relay", translate("relay mode"))

o = s:option(Flag, "fallback_relay", translate("Fallback to relay"),
	translate("Relay services from master to server interfaces when there is no public prefix available."))
o.enabled = "rd dhcpv6 ndp"
o.disabled = ""

o = s:option(Value, "master", translate("Master Interface"),
	translate("Specifies the master interface for services that are relayed."))
o.template = "cbi/network_netlist"
o.nocreate = true
o:depends("rd", "relay")
o:depends("dhcpv6", "relay")
o:depends("ndp", "relay")
o:depends("fallback_relay", "rd dhcpv6 ndp")

o = s:option(Flag, "always_rewrite_dns", translate("Always announce local DNS"),
	translate("Announce the local router as DNS server even in relay mode."))
o:depends("rd", "relay")
o:depends("dhcpv6", "relay")
o:depends("fallback_relay", "rd dhcpv6 ndp")

o = s:option(Value, "rewrite_dns_addr", translate("Override announced DNS-server"),
	translate("Announce a custom DNS-server instead of the local one."))

o = s:option(Flag, "always_assume_default", translate("Always announce default router"),
	translate("Announce as default router even if no public prefix is available."))
o:depends("rd", "server")

o = s:option(Flag, "compat_ula", translate("ULA-preference compatibility"),
	translate("Work around IPv6 address-selection issues of some devices."))

m:section(SimpleSection).template = "admin_network/lease_status"

s = m:section(TypedSection, "lease", translate("Static Leases"),
        translate("Static leases are used to assign fixed IPv6 Interface-IDs to clients. Interface-IDs are appended to available prefixes to form IPv6-addresses. " ..
            " (e.g. a prefix of 2001:db80::/64 combined with Interface-ID 123456 will form the address 2001:db80::12:3456)") .. "<br />" ..
        translate("Use the <em>Add</em> Button to add a new lease entry. The <em>DUID</em> " ..
            "indentifies the host, the <em>Interface-ID</em> specifies the ID to use in addresses."))

s.addremove = true
s.anonymous = true
s.template = "cbi/tblsection"

s:option(Value, "duid", translate("DUID")).optional = false
s:option(Value, "id", translate("Interface-ID")).optional = false

return m
