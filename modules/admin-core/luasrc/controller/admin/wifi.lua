module("luci.controller.admin.wifi", package.seeall)

function index()
	luci.i18n.loadc("admin-core")
	local i18n = luci.i18n.translate

	local page  = node("admin", "wifi")
	page.target = template("admin_wifi/index")
	page.title  = i18n("wifi", "Drahtlos")  
	page.order  = 60
	
	local page  = node("admin", "wifi", "devices")
	page.target = cbi("admin_wifi/devices")
	page.title  = i18n("devices", "Geräte")
	page.order  = 10
	
	local page  = node("admin", "wifi", "networks")
	page.target = cbi("admin_wifi/networks")
	page.title  = i18n("networks", "Netze")
	page.order  = 20
end