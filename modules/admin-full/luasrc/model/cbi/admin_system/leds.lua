--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--
m = Map("system", translate("leds"), translate("leds_desc"))

local sysfs_path = "/sys/class/leds/"
local leds = {}

if luci.fs.access(sysfs_path) then
	for k, v in pairs(luci.fs.dir(sysfs_path)) do
		if v ~= "." and v ~= ".." then
			table.insert(leds, v)
		end
	end
end

if #leds == 0 then
	return m
end


s = m:section(TypedSection, "led", "")
s.anonymous = true
s.addremove = true

function s.parse(self, ...)
	TypedSection.parse(self, ...)
	os.execute("/etc/init.d/led enable")
end


s:option(Value, "name")


sysfs = s:option(ListValue, "sysfs")
for k, v in ipairs(leds) do
	sysfs:value(v)
end

s:option(Flag, "default").rmempty = true


trigger = s:option(ListValue, "trigger")

local triggers = luci.fs.readfile(sysfs_path .. leds[1] .. "/trigger")
for t in triggers:gmatch("[%w-]+") do
	trigger:value(t, translate("system_led_trigger_" .. t:gsub("-", "")))
end 


delayon = s:option(Value, "delayon")
delayon:depends("trigger", "timer")

delayoff = s:option(Value, "delayoff")
delayoff:depends("trigger", "timer")


dev = s:option(ListValue, "dev")
dev.rmempty = true
dev:value("")
dev:depends("trigger", "netdev")
for k, v in pairs(luci.sys.net.devices()) do
	if v ~= "lo" then
		dev:value(v)
	end
end


mode = s:option(MultiValue, "mode")
mode.rmempty = true
mode:depends("trigger", "netdev")
mode:value("link", translate("system_led_mode_link"))
mode:value("tx", translate("system_led_mode_tx"))
mode:value("rx", translate("system_led_mode_rx"))

return m