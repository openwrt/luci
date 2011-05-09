--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--
module("luci.controller.admin.services", package.seeall)

function index()
	luci.i18n.loadc("base")
	local i18n = luci.i18n.translate

	local page  = node("admin", "services", "crontab")
	page.target = form("admin_services/crontab")
	page.title  = i18n("Scheduled Tasks")
	page.order  = 50

	local page  = node("admin", "services")
	page.target = template("admin_services/index")
	page.title  = i18n("Services")
	page.order  = 40
	page.index  = true
end
