
module("luci.controller.xware3", package.seeall)

function index()
	if not nixio.fs.access("/etc/config/xware3") then
		return
	end

	local page
	page = entry({"admin", "services", "xware3"}, cbi("xware3"), _("Xware3"), 56)
	page.i18n = "xware3"
	page.dependent = true
end
