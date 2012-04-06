--[[
LuCI - Lua Configuration Interface - miniDLNA support

Copyright 2012 Gabor Juhos <juhosg@openwrt.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--

module("luci.controller.minidlna", package.seeall)

function index()
	if not nixio.fs.access("/etc/config/minidlna") then
		return
	end

	local page

	page = entry({"admin", "services", "minidlna"}, cbi("minidlna"), _("miniDLNA"))
	page.i18n = "minidlna"
	page.dependent = true
end
