module("luci.controller.admin.status", package.seeall)

function index()
	local page  = node("admin", "status")
	page.target = template("admin_status/index")
	page.title  = "Status"
	page.order  = 20
	
	local page  = node("admin", "status", "syslog")
	page.target = action_syslog
	page.title  = "Systemprotokoll"
end

function action_syslog()
	local syslog = luci.sys.syslog()
	luci.template.render("admin_status/syslog", {syslog=syslog})
end