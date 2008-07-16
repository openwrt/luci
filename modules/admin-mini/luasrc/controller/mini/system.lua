--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>
Copyright 2008 Jo-Philipp Wich <xm@leipzig.freifunk.net>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--

module("luci.controller.mini.system", package.seeall)

function index()
	luci.i18n.loadc("admin-core")
	local i18n = luci.i18n.translate

	entry({"mini", "system"}, call("action_reboot"), i18n("system"))
	entry({"mini", "system", "reboot"}, call("action_reboot"), i18n("reboot"), 10)
end

function action_reboot()
	local reboot = luci.http.formvalue("reboot")
	luci.template.render("mini/reboot", {reboot=reboot})
	if reboot then
		luci.sys.reboot()
	end
end