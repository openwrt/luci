--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--
m = Map("system", translate("<abbr title=\"Light Emitting Diode\">LED</abbr> Configuration"), translate("Customizes the behaviour of the device <abbr title=\"Light Emitting Diode\">LED</abbr>s if possible."))

local sysfs_path = "/sys/class/leds/"
local leds = {}

local fs   = require "nixio.fs"
local util = require "nixio.util"

if fs.access(sysfs_path) then
	leds = util.consume((fs.dir(sysfs_path)))
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

local triggers = fs.readfile(sysfs_path .. leds[1] .. "/trigger")
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
mode:value("link", translate("Link On"))
mode:value("tx", translate("Transmit"))
mode:value("rx", translate("Receive"))

return m
