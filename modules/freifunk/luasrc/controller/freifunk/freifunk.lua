--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--
module("luci.controller.freifunk.freifunk", package.seeall)

function index()
	local i18n = luci.i18n.translate

	local page  = node()
	page.lock   = true
	page.target = alias("freifunk")

	local page    = node("freifunk")
	page.title    = "Freifunk"
	page.target   = alias("freifunk", "index")
	page.order    = 5
	page.setuser  = "nobody"
	page.setgroup = "nogroup"
	page.i18n     = "freifunk"

	local page  = node("freifunk", "index")
	page.target = template("freifunk/index")
	page.title  = "Übersicht"
	page.order  = 10

	local page  = node("freifunk", "index", "contact")
	page.target = template("freifunk/contact")
	page.title  = "Kontakt"


	local page  = node("freifunk", "status")
	page.target = call("action_status")
	page.title  = "Status"
	page.order  = 20
	page.setuser  = false
	page.setgroup = false

	assign({"freifunk", "status", "iwscan"}, {"admin", "status", "iwscan"}, "WLAN-Scan", 20)
	
	assign({"freifunk", "olsr"}, {"admin", "status", "olsr"}, "OLSR", 30)

	if luci.fs.isfile("/etc/config/luci_statistics") then
		assign({"freifunk", "statistics"}, {"admin", "statistics", "graph"}, i18n("stat_statistics", "Statistiken"), 40)
	end

	local page  = node("admin", "index", "freifunk")
	page.target = cbi("freifunk/freifunk")
	page.title  = "Freifunk"
	page.order  = 30

	local page  = node("admin", "index", "contact")
	page.target = cbi("freifunk/contact")
	page.title  = "Kontakt"
	page.order  = 40
end
