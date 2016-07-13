module("luci.controller.wol", package.seeall)

function index()
	entry({"admin", "network", "wol"}, cbi("wol"), _("Wake on LAN"), 90).dependent = true
	entry({"mini", "network", "wol"}, cbi("wol"), _("Wake on LAN"), 90).dependent = true
end
