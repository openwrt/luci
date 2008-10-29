module("luci.controller.luci_fw.luci_fw", package.seeall)

function index()
	require("luci.i18n").loadc("luci-fw")
	local i18n = luci.i18n.translate
	
	local nodes = {}

	table.insert(nodes, entry({"admin", "network", "firewall"}, alias("admin", "network", "firewall", "zones"), i18n("fw_fw"), 60))
	nodes[#nodes].index = true
	
	table.insert(nodes, entry({"admin", "network", "firewall", "zones"}, cbi("luci_fw/zones"), i18n("fw_zones"), 10))
	table.insert(nodes, entry({"admin", "network", "firewall", "redirection"}, cbi("luci_fw/redirect"), i18n("fw_redirect"), 30))	
	table.insert(nodes, entry({"admin", "network", "firewall", "traffic"}, cbi("luci_fw/traffic"), i18n("fw_traffic"), 20))
		
	table.insert(nodes, entry({"admin", "network", "firewall", "rule"}, cbi("luci_fw/trule")))
	nodes[#nodes].leaf = true
	table.insert(nodes, entry({"admin", "network", "firewall", "redirect"}, cbi("luci_fw/rrule")))
	nodes[#nodes].leaf = true
	
	table.insert(nodes, entry({"mini", "network", "portfw"}, cbi("luci_fw/miniportfw"), i18n("fw_portfw", "Portweiterleitung"), 70))
	
	for i,n in ipairs(nodes) do
		n.i18n = "luci-fw"
		n.dependent = true
	end	
end