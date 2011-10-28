module("luci.controller.luci_fw.luci_fw", package.seeall)

function index()
	entry({"admin", "network", "firewall"}, alias("admin", "network", "firewall", "zones"), _("Firewall"), 60).i18n = "firewall"
	entry({"admin", "network", "firewall", "zones"}, arcombine(cbi("luci_fw/zones"), cbi("luci_fw/zone")), nil, 10).leaf = true
	entry({"admin", "network", "firewall", "rule"}, arcombine(cbi("luci_fw/zones"), cbi("luci_fw/trule")), nil, 20).leaf = true
	entry({"admin", "network", "firewall", "redirect"}, arcombine(cbi("luci_fw/zones"), cbi("luci_fw/rrule")), nil, 30).leaf = true

	entry({"mini", "network", "portfw"}, cbi("luci_fw/miniportfw", {autoapply=true}), _("Port forwarding"), 70).i18n = "firewall"
end
