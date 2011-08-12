module("luci.controller.multiwan", package.seeall)

function index()
	local fs = luci.fs or nixio.fs
	if not fs.access("/etc/config/multiwan") then
		return
	end

	local page

	page = entry({"admin", "network", "multiwan"}, cbi("multiwan/multiwan"), _("Multi-WAN"))
	page.i18n = "multiwan"
	page.dependent = true

	page = entry({"mini", "network", "multiwan"}, cbi("multiwan/multiwanmini", {autoapply=true}), _("Multi-WAN"))
	page.i18n = "multiwan"
	page.dependent = true
end
