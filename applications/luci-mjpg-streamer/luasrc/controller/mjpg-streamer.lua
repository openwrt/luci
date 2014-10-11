--[[
LuCI - Lua Configuration Interface - mjpg-streamer support

Script by oldoldstone@gmail.com 

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--

module("luci.controller.mjpg-streamer", package.seeall)

function index()
	
	if not nixio.fs.access("/etc/config/mjpg-streamer") then
		return
	end

	local page
	page = entry({"admin", "services", "mjpg-streamer"}, cbi("mjpg-streamer"), _("mjpg-streamer"), 50)
	page.i18n = "mjpg-streamer"
	page.dependent = true
end
