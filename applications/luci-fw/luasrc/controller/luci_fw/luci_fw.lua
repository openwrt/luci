module("luci.controller.luci_fw.luci_fw", package.seeall)

function index()
	require("luci.i18n").loadc("luci-fw")
	local i18n = luci.i18n.translate
	
	local nodes = {}

	table.insert(nodes, entry({"admin", "network", "firewall"}, alias("admin", "network", "firewall", "zones"), i18n("fw_fw"), 60))
	table.insert(nodes, entry({"admin", "network", "firewall", "zones"}, cbi("luci_fw/general"), i18n("fw_zones"), 10))
	table.insert(nodes, entry({"admin", "network", "firewall", "portfw"}, cbi("luci_fw/portfw"), i18n("fw_portfw"), 20))	
	table.insert(nodes, entry({"admin", "network", "firewall", "forwarding"}, cbi("luci_fw/routing"), i18n("fw_forwarding"), 30))
	table.insert(nodes, entry({"admin", "network", "firewall", "rules"}, cbi("luci_fw/firewall"), i18n("fw_rules"), 40))	
	table.insert(nodes, entry({"admin", "network", "firewall", "customfwd"}, cbi("luci_fw/customfwd"), i18n("fw_custfwd"), 50))	
	
	table.insert(nodes, entry({"mini", "network", "portfw"}, cbi("luci_fw/miniportfw"), i18n("fw_portfw", "Portweiterleitung"), 70))
	
	for i,n in ipairs(nodes) do
		n.i18n = "luci-fw"
		n.dependent = true
	end	
end