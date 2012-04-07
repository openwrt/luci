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

	entry({"admin", "services", "minidlna_status"}, call("minidlna_status"))
end

function minidlna_status()
	local sys  = require "luci.sys"
	local uci  = require "luci.model.uci".cursor()
	local port = tonumber(uci:get_first("minidlna", "minidlna", "port"))

	local status = {
		running = (sys.call("pidof minidlna >/dev/null") == 0),
		audio   = 0,
		video   = 0,
		image   = 0
	}

	if status.running then
		local fd = sys.httpget("http://127.0.0.1:%d/" % (port or 8200), true)
		if fd then
			local ln
			repeat
				ln = fd:read("*l")
				if ln and ln:match("files:") then
					local ftype, fcount = ln:match("(.+) files: (%d+)")
					status[ftype:lower()] = tonumber(fcount) or 0
				end
			until not ln
			fd:close()
		end
	end

	luci.http.prepare_content("application/json")
	luci.http.write_json(status)
end
