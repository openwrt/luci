module("luci.controller.freifunk.freifunk", package.seeall)

function index()
	local page  = node()
	page.target = alias("freifunk")

	local page    = node("freifunk")
	page.title    = "Freifunk"
	page.target   = alias("freifunk", "index")
	page.order    = 5
	page.setuser  = "nobody"
	page.setgroup = "nogroup"
	
	local page  = node("freifunk", "index")
	page.target = template("freifunk/index")
	page.title  = "Übersicht"
	page.order  = 10
	
	local page  = node("freifunk", "index", "contact")
	page.target = template("freifunk/contact")
	page.title  = "Kontakt"
	
	
	local page  = node("freifunk", "status")
	page.target = action_status
	page.title  = "Status"
	page.order  = 20
	page.setuser  = false
	page.setgroup = false

	local page  = node("freifunk", "status", "routes")
	page.target = template("public_status/routes")
	page.title  = "Routingtabelle"
	page.order  = 10
	
	local page  = node("freifunk", "status", "iwscan")
	page.target = template("public_status/iwscan")
	page.title  = "WLAN-Scan"
	page.order  = 20	
	
	local page  = node("admin", "index", "freifunk")
	page.target = cbi("freifunk/freifunk")
	page.title  = "Freifunk"
	page.order  = 30
	
	local page  = node("admin", "index", "contact")
	page.target = cbi("freifunk/contact")
	page.title  = "Kontakt"
	page.order  = 40
end

function action_status()
	local data = {}
	
	data.s, data.m, data.r = luci.sys.sysinfo()
	
	data.wifi = luci.sys.wifi.getiwconfig()
	
	data.routes = {}
	for i, r in pairs(luci.sys.net.routes()) do
		if r.Destination == "00000000" then
			table.insert(data.routes, r)
		end
	end

	
	luci.template.render("public_status/index", data)
end