module("luci.controller.admin.index", package.seeall)

function index()
	local root = node()
	if not root.target then
		root.target = alias("admin")
	end
	
	entry({"about"}, template("about"))
	
	local page  = node("admin")
	page.target = alias("admin", "index")
	page.title  = "Administration"
	page.order  = 10
	
	local page  = node("admin", "index")
	page.target = template("admin_index/index")
	page.title  = "Übersicht"
	page.order  = 10
	
	local page  = node("admin", "index", "luci")
	page.target = cbi("admin_index/luci")
	page.title  = "Oberfläche"
	
	
end