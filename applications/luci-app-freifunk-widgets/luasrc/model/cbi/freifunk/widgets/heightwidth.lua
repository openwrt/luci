-- Copyright 2012 Manuel Munz <freifunk at somakoma dot de>
-- Licensed to the public under the Apache License 2.0.

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
