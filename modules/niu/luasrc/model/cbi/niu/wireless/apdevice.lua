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

m = Map("wireless", "Configure Private Access Point")
s = m:section(NamedSection, "ap", "interface", "Wireless Radio Device",
"Select the wireless radio device that should be used to run the access"..
" point. Note that wireless radios will not show up here if you already use"..
" them for connecting to the Internet and are not capable of being used as"..
" an access point in parallel.")
s.anonymous = true
s.addremove = false

l = s:option(ListValue, "device", "Device providing Access Point")

for _, wifi in ipairs(niulib.wifi_get_available("ap")) do
	l:value(wifi, "WLAN-Adapter (%s)" % wifi)
end
l:value("none", "Disable Private Access Point")

return m
