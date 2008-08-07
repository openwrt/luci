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

s = m:section(TypedSection, "led", "")
s.anonymous = true
s.addremove = true


s:option(Value, "name")

sysfs = s:option(ListValue, "sysfs")
for k, v in pairs(luci.fs.dir("/sys/class/leds/")) do
	if v ~= "." and v ~= ".." then
		sysfs:value(v)
	end
end

s:option(Flag, "default").rmempty = true

trigger = s:option(Value, "trigger")
trigger.rmempty = true
trigger:value("netdev")


dev = s:option(ListValue, "dev")
dev.rmempty = true
dev:value("")
dev:depends("trigger", "netdev")
for k, v in pairs(luci.sys.net.devices()) do
	if v ~= "lo" then
		dev:value(v)
	end
end

mode = s:option(Value, "mode")
mode.rmempty = true
mode:value("link")
mode:depends("trigger", "netdev")
