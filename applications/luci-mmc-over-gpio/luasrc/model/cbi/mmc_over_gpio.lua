--[[

LuCI mmc_over_gpio
(c) 2008 Yanira <forum-2008@email.de>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

$Id$

]]--

m = Map("mmc_over_gpio", translate("MMC/SD driver configuration"),
	translate("MMC/SD driver configuration"))

s = m:section(TypedSection, "mmc_over_gpio", translate("Settings"))
s.addremove = true
s.anonymous = true

s:option(Flag, "enabled", translate("Enable"))

s:option(Value, "name", translate("Name"))

pin = s:option(Value, "DI_pin", translate("DI_pin"))
for i = 0,7 do pin:value(i) end

pin = s:option(Value, "DO_pin", translate("DO_pin"))
for i = 0,7 do pin:value(i) end

pin = s:option(Value, "CLK_pin", translate("CLK_pin"))
for i = 0,7 do pin:value(i) end

pin = s:option(Value, "CS_pin", translate("CS_pin"))
for i = 0,7 do pin:value(i) end

s:option(Value, "mode", translate("Mode"))

return m
