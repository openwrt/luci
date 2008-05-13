module("ffluci.controller.admin.status", package.seeall)

function action_syslog()
	local syslog = ffluci.sys.syslog()
	ffluci.template.render("admin_status/syslog", {syslog=syslog})
end