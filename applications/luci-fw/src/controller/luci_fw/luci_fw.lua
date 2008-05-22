module("ffluci.controller.luci_fw.luci_fw", package.seeall)

function index()
	entry({"admin", "network", "portfw"}, cbi("luci_fw/portfw"), "Portweiterleitung", 70)
	entry({"admin", "network", "routing"}, cbi("luci_fw/routing"), "Routing", 72)
	entry({"admin", "network", "firewall"}, cbi("luci_fw/firewall"), "Firewall", 74)
end