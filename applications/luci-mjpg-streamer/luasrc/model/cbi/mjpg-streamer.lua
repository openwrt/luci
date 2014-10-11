--[[
LuCI - Lua Configuration Interface - mjpg-streamer support

Script by oldoldstone@gmail.com 

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--

local fs = require "nixio.fs"

local running=(luci.sys.call("pidof mjpg_streamer > /dev/null") == 0)
m=Map("mjpg-streamer",translate("MJPG Streamer"),translate("MJPG-streamer takes JPGs from Linux-UVC compatible webcams, filesystem or other input plugins and streams them as M-JPEG via HTTP to webbrowsers, VLC and other software."))

s = m:section(TypedSection, "mjpg-streamer", translate("Settings"))
s.anonymous = true

s:option(Flag, "enabled", translate("Enable"))

device = s:option(Value, "device", translate("Device"))
device.rmempty = false
for dev in nixio.fs.glob("/dev/video[0-9]") do
	device:value(nixio.fs.basename(dev))
end

resolution = s:option(Value, "resolution", translate("Resolution"))
resolution.rmempty = false

fps = s:option(Value, "fps", translate("FPS"))
fps.rmempty = false

www = s:option(Value, "www", translate("Web folder"))
www.rmempty = false

port = s:option(Value, "port", translate("Port"))
port.rmempty = false

username=s:option(Value, "username", translate("User Name"))
password=s:option(Value, "password", translate("Password"))
password.password = true

return m
