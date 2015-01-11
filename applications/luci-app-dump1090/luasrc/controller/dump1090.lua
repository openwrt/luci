--[[
LuCI - Lua Configuration Interface - dump1090 support

Copyright 2014 Álvaro Fernández Rojas <noltari@gmail.com>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--

module("luci.controller.dump1090", package.seeall)

function index()
	if not nixio.fs.access("/etc/config/dump1090") then
		return
	end

	local page = entry({"admin", "services", "dump1090"}, cbi("dump1090"), _("dump1090"))
	page.dependent = true

end
