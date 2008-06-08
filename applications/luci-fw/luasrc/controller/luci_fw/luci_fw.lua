module("luci.controller.luci_fw.luci_fw", package.seeall)

function index()
	require("luci.i18n").loadc("luci-fw")
	local i18n = luci.i18n.translate

	entry({"admin", "network", "portfw"}, cbi("luci_fw/portfw"), i18n("fw_portfw", "Portweiterleitung"), 70).i18n = "luci-fw"
	entry({"admin", "network", "routing"}, cbi("luci_fw/routing"), i18n("fw_routing", "Routing"), 73).i18n = "luci-fw"
	entry({"admin", "network", "firewall"}, cbi("luci_fw/firewall"), i18n("fw_fw", "Firewall"), 76).i18n = "luci-fw"
end