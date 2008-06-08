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
	local i18n = luci.i18n.translate

	local page  = node("admin", "network")
	page.target = template("admin_network/index")
	page.title  = i18n("network", "Netzwerk")  
	page.order  = 50
	
	local page  = node("admin", "network", "vlan")
	page.target = cbi("admin_network/vlan")
	page.title  = i18n("a_n_switch", "Switch")
	page.order  = 10
	
	local page  = node("admin", "network", "ifaces")
	page.target = cbi("admin_network/ifaces")
	page.title  = i18n("interfaces", "Schnittstellen")
	page.order  = 20
	
	local page  = node("admin", "network", "dhcp")
	page.target = cbi("admin_network/dhcp")
	page.title  = "DHCP"
	page.order  = 30
	
	local page  = node("admin", "network", "ptp")
	page.target = cbi("admin_network/ptp")
	page.title  = "PPPoE / PPTP"
	page.order  = 40
	
	local page  = node("admin", "network", "routes")
	page.target = cbi("admin_network/routes")
	page.title  = i18n("a_n_routes", "Routen")
	page.order  = 50
end