--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--
module("luci.controller.admin.network", package.seeall)

function index()
	require("luci.i18n")
	local uci = require("luci.model.uci").cursor()
	local i18n = luci.i18n.translate

	local page  = node("admin", "network")
	page.target = alias("admin", "network", "network")
	page.title  = i18n("network")
	page.order  = 50
	page.index  = true

	local page  = node("admin", "network", "vlan")
	page.target = cbi("admin_network/vlan")
	page.title  = i18n("a_n_switch")
	page.order  = 20

	local page  = node("admin", "network", "wireless")
	page.target = form("admin_network/wireless")
	page.title  = i18n("wifi")
	page.i18n   = "wifi"
	page.order  = 15
	page.subindex = true
	uci:foreach("wireless", "wifi-device",
		function (section)
			local ifc = section[".name"]
				entry({"admin", "network", "wireless", ifc},
				 alias("admin", "network", "wifi", ifc),
				 ifc:upper()).i18n = "wifi"
		end
	)

	local page  = node("admin", "network", "wifi")
	page.target = cbi("admin_network/wifi")
	page.leaf   = true
	page.i18n = "wifi"

	local page  = node("admin", "network", "network")
	page.target = cbi("admin_network/network")
	page.title  = i18n("interfaces", "Schnittstellen")
	page.order  = 10
	page.subindex = true
	uci:foreach("network", "interface",
		function (section)
			local ifc = section[".name"]
			if ifc ~= "loopback" then
				entry({"admin", "network", "network", ifc},
				 alias("admin", "network", "ifaces", ifc),
				 ifc:upper())
			end
		end
	)

	local page  = node("admin", "network", "ifaces")
	page.target = cbi("admin_network/ifaces")
	page.leaf   = true

	local page  = node("admin", "network", "dhcp")
	page.target = cbi("admin_network/dhcp")
	page.title  = "DHCP"
	page.order  = 30
	page.subindex = true

	entry(
	 {"admin", "network", "dhcp", "leases"},
	 cbi("admin_network/dhcpleases"),
	 i18n("dhcp_leases")
	)

	local page  = node("admin", "network", "hosts")
	page.target = cbi("admin_network/hosts")
	page.title  = i18n("hostnames", "Hostnames")
	page.order  = 40

	local page  = node("admin", "network", "routes")
	page.target = cbi("admin_network/routes")
	page.title  = i18n("a_n_routes")
	page.order  = 50
	page.leaf   = true

	entry(
	 {"admin", "network", "routes", "static"},
	 function() end,
	 i18n("a_n_routes_static")
	)

	entry(
		{"admin", "network", "conntrack"},
		form("admin_network/conntrack"),
		i18n("a_n_conntrack"),
		60
	)

end
