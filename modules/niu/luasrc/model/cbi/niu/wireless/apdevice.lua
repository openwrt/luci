--[[
LuCI - Lua Configuration Interface

Copyright 2009 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--
local niulib = require "luci.niulib"
local cursor = require "luci.model.uci".inst

m = Map("wireless", translate("Configure Private Access Point"))
s = m:section(NamedSection, "ap", "wifi-iface", translate("Wireless Radio Device"),
translate(
"Select the wireless radio device that should be used to run the interface."..
" Note that wireless radios will not show up here if you already use"..
" them for other wireless services and are not capable of being used by"..
" more than one service simultaneously or run this specific service at all."))
s.anonymous = true
s.addremove = false

local l = s:option(ListValue, "device", translate("Wireless Device"))

for _, wifi in ipairs(niulib.wifi_get_available("ap")) do
	l:value(wifi, translate("WLAN-Adapter (%s)") % wifi)
end
l:value("none", translate("Disable Private Access Point"))


local extend = cursor:get("wireless", "bridge", "network")
	and cursor:get("wireless", "bridge", "ssid")
	
if extend ~= cursor:get("wireless", "ap", "ssid") then
	local templ = s:option(ListValue, "_cfgtpl", translate("Configuration Template"))
	templ:depends({["!default"] = 1})
	templ:depends({["!reverse"] = 1, device = "none"})
	templ:value("", translate("Access Point (Current Settings)"))
	templ:value("bridge", translate("Extend network %s") % extend)
end

return m
