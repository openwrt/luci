module("luci.controller.admin.status", package.seeall)

function index()
	entry({"admin", "status"}, template("admin_status/index"), "Status", 20)
	entry({"admin", "status", "syslog"}, call("action_syslog"), "Systemprotokoll")
end

function action_syslog()
	local syslog = luci.sys.syslog()
	luci.template.render("admin_status/syslog", {syslog=syslog})
end