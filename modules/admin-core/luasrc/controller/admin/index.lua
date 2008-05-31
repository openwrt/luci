module("luci.controller.admin.index", package.seeall)

function index()
	luci.i18n.loadc("admin-core")
	local i18n = luci.i18n.translate

	local root = node()
	if not root.target then
		root.target = alias("admin")
	end
	
	entry({"about"}, template("about")).i18n = "admin-core"
	
	local page  = node("admin")
	page.target = alias("admin", "index")
	page.title  = i18n("administration", "Administration")
	page.order  = 10
	page.i18n   = "admin-core"
	
	local page  = node("admin", "index")
	page.target = template("admin_index/index")
	page.title  = i18n("overview", "Übersicht")
	page.order  = 10
	
	local page  = node("admin", "index", "luci")
	page.target = cbi("admin_index/luci")
	page.title  = i18n("a_i_ui", "Oberfläche")
	
	
end