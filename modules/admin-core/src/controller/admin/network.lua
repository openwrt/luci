module("luci.controller.admin.network", package.seeall)

function index()
	local page  = node("admin", "network")
	page.target = template("admin_network/index")
	page.title  = "Netzwerk"  
	page.order  = 50
	
	local page  = node("admin", "network", "vlan")
	page.target = cbi("admin_network/vlan")
	page.title  = "Switch"
	page.order  = 10
	
	local page  = node("admin", "network", "ifaces")
	page.target = cbi("admin_network/ifaces")
	page.title  = "Schnittstellen"
	page.order  = 20
	
	local page  = node("admin", "network", "dhcp")
	page.target = cbi("admin_network/dhcp")
	page.title  = "DHCP-Server"
	page.order  = 30
	
	local page  = node("admin", "network", "ptp")
	page.target = cbi("admin_network/ptp")
	page.title  = "PPPoE / PPTP"
	page.order  = 40
	
	local page  = node("admin", "network", "routes")
	page.target = cbi("admin_network/routes")
	page.title  = "Statische Routen"
	page.order  = 50
	
	if luci.fs.isfile("/etc/config/qos") then
		local page  = node("admin", "network", "qos")
		page.target = cbi("admin_network/qos")
		page.title  = "Quality of Service"
	end
end