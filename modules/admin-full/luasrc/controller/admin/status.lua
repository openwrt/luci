--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--
module("luci.controller.admin.status", package.seeall)

function index()
	luci.i18n.loadc("admin-core")
	local i18n = luci.i18n.translate

	entry({"admin", "status"}, template("admin_status/index"), i18n("status", "Status"), 20).index = true
	entry({"admin", "status", "interfaces"}, template("admin_status/interfaces"), i18n("interfaces", "Interfaces"), 1)
	entry({"admin", "status", "iptables"}, call("action_iptables"), i18n("a_s_ipt", "Firewall"), 2)
	entry({"admin", "status", "syslog"}, call("action_syslog"), i18n("syslog", "Systemprotokoll"), 3)
	entry({"admin", "status", "dmesg"}, call("action_dmesg"), i18n("dmesg", "Kernelprotokoll"), 4)

end

function action_syslog()
	local syslog = luci.sys.syslog()
	luci.template.render("admin_status/syslog", {syslog=syslog})
end

function action_dmesg()
	local dmesg = luci.sys.dmesg()
	luci.template.render("admin_status/dmesg", {dmesg=dmesg})
end

function action_iptables()
	if luci.http.formvalue("zero") == "1" then
		luci.util.exec("iptables -Z")
		luci.http.redirect(
			luci.dispatcher.build_url("admin", "status", "iptables")
		)
	elseif luci.http.formvalue("restart") == "1" then
		luci.util.exec("/etc/init.d/firewall restart")
		luci.http.redirect(
			luci.dispatcher.build_url("admin", "status", "iptables")
		)
	else
		luci.template.render("admin_status/iptables")
	end
end
