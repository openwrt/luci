--[[
LuCI - Lua Configuration Interface

Copyright 2009 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--

local iwinfo = require "iwinfo"
local cursor = require "luci.model.uci".inst
cursor:unload("wireless")

m = Map("wireless", "Configure Private Access Point")
s = m:section(NamedSection, "ap", "interface", "Wireless Radio Device",
"Select the wireless radio device that should be used to run the access"..
" point. Note that wireless radios will not show up here if you already use"..
" them for connecting to the Internet and are not capable of being used as"..
" an access point in parallel.")
s.anonymous = true
s.addremove = false

l = s:option(ListValue, "device", "Device providing Access Point")

local used = {}
cursor:foreach("wireless", "wifi-iface", function(s)
	if s[".name"] ~= "ap" and s._niu == 1 then
		used[s.device] = 1
	end
end)

for k in pairs(used) do
	local t = iwinfo.type(k)
	if t and iwinfo[t] then
		used[k] = (iwinfo[t].mbssid_support() < 1)
	end
end

cursor:foreach("wireless", "wifi-device", function(s)
	if not used[s[".name"]] then
		l:value(s[".name"], "Radio %s" % s[".name"])
	end
end)
l:value("none", "Disable Private Access Point")

return m
