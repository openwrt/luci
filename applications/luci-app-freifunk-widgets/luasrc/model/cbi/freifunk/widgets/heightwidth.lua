--[[
LuCI - Lua Configuration Interface

Copyright 2012 Manuel Munz <freifunk at somakoma dot de>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

]]--

local map, section = ...

local width = wdg:option(Value, "width", translate("Width"))
width.rmempty = true

--[[
local height = wdg:option(Value, "height", translate("Height"))
height.rmempty = true
height.optional = true
]]--

local pr = wdg:option(Value, "paddingright", translate("Padding right"))
pr.rmempty = true
