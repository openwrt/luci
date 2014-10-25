--[[
RA-MOD
]]--

module("luci.controller.redsocks2", package.seeall)

function index()

	local page
	page = node("admin", "RA-MOD")
	page.target = firstchild()
	page.title = _("RA-MOD")
	page.order  = 65

	page = entry({"admin", "services", "redsocks2"}, cbi("redsocks2"), _("redsocks2"), 50)
	page.i18n = "redsocks2"
	page.dependent = true
end
