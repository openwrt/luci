module("luci.controller.admin.status", package.seeall)

function index()
	luci.i18n.loadc("admin-core")
	local i18n = luci.i18n.translate

	entry({"admin", "status"}, template("admin_status/index"), i18n("status", "Status"), 20)
	entry({"admin", "status", "syslog"}, call("action_syslog"), i18n("syslog", "Systemprotokoll"))
	entry({"admin", "status", "routes"}, template("admin_status/routes"), "Routingtabelle", 10)
	entry({"admin", "status", "iwscan"}, template("admin_status/iwscan"), "WLAN-Scan", 20)
end

function action_syslog()
	local syslog = luci.sys.syslog()
	luci.template.render("admin_status/syslog", {syslog=syslog})
end