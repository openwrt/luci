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

m = Map("wireless", translate("Join a local WDS network"))
s = m:section(NamedSection, "bridge", "wifi-iface", translate("Wireless Radio Device"),
translate(
"Select the wireless radio device that should be used to run the interface."..
" Note that wireless radios will not show up here if you already use"..
" them for other wireless services and are not capable of being used by"..
" more than one service simultaneously or run this specific service at all."))
s.anonymous = true
s.addremove = false

l = s:option(ListValue, "device", translate("Wireless Device"))

for _, wifi in ipairs(niulib.wifi_get_available("bridge", {atheros = true, mac80211 = true})) do
	l:value(wifi, translate("WLAN-Adapter (%s)") % wifi)
end
l:value("none", translate("Disable Bridge"))

return m
