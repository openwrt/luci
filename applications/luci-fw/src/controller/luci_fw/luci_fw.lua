module("ffluci.controller.luci_fw.luci_fw", package.seeall)

function index()
	local page = node("admin", "network", "portfw")
	page.target = cbi("luci_fw/portfw")
	page.title = "Portweiterleitung"
	page.order = 70
	
	local page = node("admin", "network", "routing")
	page.target = cbi("luci_fw/routing")
	page.title = "Routing"
	page.order = 72
	
	local page = node("admin", "network", "firewall")
	page.target = cbi("luci_fw/firewall")
	page.title = "Firewall"
	page.order = 74
end