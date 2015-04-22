--[[
RA-MOD
]]--

module("luci.controller.chinadns", package.seeall)

function index()
	
	if not nixio.fs.access("/etc/config/chinadns") then
		return
	end

	local page

	page = entry({"admin", "services" , "chinadns"}, cbi("chinadns"), _("chinadns"), 55)
	page.i18n = "chinadns"
	page.dependent = true
end
