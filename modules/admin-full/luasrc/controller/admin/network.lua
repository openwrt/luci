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
	require("luci.model.uci")
	local i18n = luci.i18n.translate

	local page  = node("admin", "network")
	page.target = template("admin_network/index")
	page.title  = i18n("network")  
	page.order  = 50
	
	local page  = node("admin", "network", "vlan")
	page.target = cbi("admin_network/vlan")
	page.title  = i18n("a_n_switch")
	page.order  = 20
	
	local page  = node("admin", "network", "network")
	page.target = cbi("admin_network/network")
	page.title  = i18n("interfaces", "Schnittstellen")
	page.order  = 10
	luci.model.uci.foreach("network", "interface",
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
	
	entry(
	 {"admin", "network", "dhcp", "leases"},
	 cbi("admin_network/dhcpleases"),
	 i18n("dhcp_leases")
	) 
	
	local page  = node("admin", "network", "routes")
	page.target = cbi("admin_network/routes")
	page.title  = i18n("a_n_routes")
	page.order  = 40
	page.leaf   = true
	
	entry(
	 {"admin", "network", "routes", "static"},
	 function() end,
	 i18n("a_n_routes_static")
	)

end