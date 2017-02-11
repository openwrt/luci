module("luci.controller.wol", package.seeall)

function index()
	entry({"admin", "services", "wol"}, cbi("wol"), _("Wake on LAN"), 90)
	entry({"mini", "services", "wol"}, cbi("wol"), _("Wake on LAN"), 90)
end
