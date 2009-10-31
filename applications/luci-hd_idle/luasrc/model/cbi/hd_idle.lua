--[[

LuCI hd-idle
(c) 2008 Yanira <forum-2008@email.de>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

$Id$

]]--

require("nixio.fs")

m = Map("hd-idle", translate("hd-idle"), translate("hd-idle is a utility program for spinning-down external disks after a period of idle time."))

s = m:section(TypedSection, "hd-idle", translate("Settings"))
s.anonymous = true

s:option(Flag, "enabled", translate("enable"))

disk = s:option(Value, "disk", translate("Disk"))
disk.rmempty = true
for dev in nixio.fs.glob("/dev/[sh]d[a-z]") do
	disk:value(nixio.fs.basename(dev))
end

s:option(Value, "idle_time_interval", translate("Idle-Time")).default = 10
s.rmempty = true
unit = s:option(ListValue, "idle_time_unit", translate("Idle-Time unit"))
unit.default = "minutes"
unit:value("minutes", "min")
unit:value("hours", "h")
unit.rmempty = true

s:option(Flag, "enable_debug", translate("Enable debug"))

return m
