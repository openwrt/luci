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
	local page

	page        = node("admin", "services", "crontab")
	page.target = form("admin_services/crontab")
	page.title  = _("Scheduled Tasks")
	page.order  = 50

	page        = node("admin", "services")
	page.target = template("admin_services/index")
	page.title  = _("Services")
	page.order  = 40
	page.index  = true
end
