--[[

LuCI UVC Streamer
(c) 2008 Yanira <forum-2008@email.de>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

$Id$

]]--

-- find current lan address and port of first uvc_streamer config section
local uci  = luci.model.uci.cursor_state()
local addr = uci:get("network", "lan", "ipaddr")
local port

uci:foreach( "uvc-streamer", "uvc-streamer",
	function(section) port = port or tonumber(section.port) end )

addr = addr or "192.168.1.1"
port = port or 8080

m = Map("uvc-streamer", translate("uvc_streamer"),
	translatef("uvc_streamer_desc", nil, addr, port, addr, port))

s = m:section(TypedSection, "uvc-streamer", translate("settings"))
s.addremove = false
s.anonymous = true

s:option(Flag, "enabled", translate("enabled", "Enable"))

s:option(Value, "device", translate("device")).rmempty = true

nm = s:option(Value, "resolution", translate("resolution"))
nm:value("640x480")
nm:value("320x240")
nm:value("160x120")

s:option(Value, "framespersecond", translate("framespersecond")).rmempty = true

s:option(Value, "port", translate("port", "Port")).rmempty = true

return m
