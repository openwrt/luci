--[[
LuCI MJPEG Streamer

(c) 2014 Roger D <rogerdammit@gmail.com>
Based on work by: vargabab and OpenWrt Dreambox

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--

module("luci.controller.mjpg-streamer", package.seeall)

function index()
	require("luci.i18n")
	luci.i18n.loadc("mjpg-streamer")
	if not nixio.fs.access("/etc/config/mjpg-streamer") then
		return
	end

	local page = entry({"admin", "services", "mjpg-streamer"}, cbi("mjpg-streamer"), _("MJPG-streamer"))
	page.i18n = "mjpg-streamer"
	page.dependent = true

end
