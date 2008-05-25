module("luci.controller.admin.wifi", package.seeall)

function index()
	local page  = node("admin", "wifi")
	page.target = template("admin_wifi/index")
	page.title  = "Drahtlos"  
	page.order  = 60
	
	local page  = node("admin", "wifi", "devices")
	page.target = cbi("admin_wifi/devices")
	page.title  = "Geräte"
	page.order  = 10
	
	local page  = node("admin", "wifi", "networks")
	page.target = cbi("admin_wifi/networks")
	page.title  = "Netze"
	page.order  = 20
end