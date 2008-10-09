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
	page.subindex = true
	page.index = false

	local page    = node("freifunk")
	page.title    = "Freifunk"
	page.target   = alias("freifunk", "index")
	page.order    = 5
	page.setuser  = "nobody"
	page.setgroup = "nogroup"
	page.i18n     = "freifunk"
	page.index    = true
	
	local page  = node("freifunk", "index")
	page.target = template("freifunk/index")
	page.title  = "Übersicht"
	page.order  = 10
	page.indexignore = true
	
	local page  = node("freifunk", "index", "contact")
	page.target = template("freifunk/contact")
	page.title  = "Kontakt"
	
	
	local page  = node("freifunk", "status")
	page.target = form("freifunk/public_status")
	page.title  = "Status"
	page.order  = 20
	page.i18n   = "admin-core"
	page.setuser  = false
	page.setgroup = false
	
	assign({"freifunk", "olsr"}, {"admin", "status", "olsr"}, "OLSR", 30)
	
	if luci.fs.isfile("/etc/config/luci_statistics") then
		assign({"freifunk", "graph"}, {"admin", "statistics", "graph"}, i18n("stat_statistics", "Statistiken"), 40)
	end
	
	assign({"mini", "freifunk"}, {"admin", "freifunk"}, "Freifunk", 15)
	entry({"admin", "freifunk"}, alias("admin", "freifunk", "index"), "Freifunk", 15)
	local page  = node("admin", "freifunk", "index")
	page.target = cbi("freifunk/freifunk")
	page.title  = "Freifunk"
	page.order  = 30
	
	local page  = node("admin", "freifunk", "contact")
	page.target = cbi("freifunk/contact")
	page.title  = "Kontakt"
	page.order  = 40
end

function action_status()
	local data = {}
	
	data.system, data.model, data.memtotal, data.memcached, data.membuffers, data.memfree = luci.sys.sysinfo()
	data.perc_memfree = math.floor((data.memfree/data.memtotal)*100)
	data.perc_membuffers = math.floor((data.membuffers/data.memtotal)*100)
	data.perc_memcached = math.floor((data.memcached/data.memtotal)*100)
	
	data.wifi = luci.sys.wifi.getiwconfig()
	
	data.routes = {}
	for i, r in pairs(luci.sys.net.routes()) do
		if r.Destination == "00000000" then
			table.insert(data.routes, r)
		end
	end

	
	luci.template.render("public_status/index", data)
end