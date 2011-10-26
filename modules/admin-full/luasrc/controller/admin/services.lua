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
	entry({"admin", "services"}, firstchild(), _("Services"), 40).index = true
	entry({"admin", "services", "crontab"}, form("admin_services/crontab"), _("Scheduled Tasks"), 50)
end
