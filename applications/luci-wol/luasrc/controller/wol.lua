module("luci.controller.wol", package.seeall)

function index()
	require("luci.i18n").loadc("wol")
	local i18n = luci.i18n.translate

	entry({"admin", "network", "wol"}, cbi("wol"), i18n("Wake on LAN"), 90).i18n = "wol"
	entry({"mini", "network", "wol"}, cbi("wol"), i18n("Wake on LAN"), 90).i18n = "wol"
end
