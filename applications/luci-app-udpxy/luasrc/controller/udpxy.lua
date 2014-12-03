--[[
LuCI - Lua Configuration Interface - udpxy support

Copyright 2014 Álvaro Fernández Rojas <noltari@gmail.com>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--

module("luci.controller.udpxy", package.seeall)

function index()
	if not nixio.fs.access("/etc/config/udpxy") then
		return
	end

	local page = entry({"admin", "services", "udpxy"}, cbi("udpxy"), _("udpxy"))
	page.dependent = true

end
