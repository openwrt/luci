local map, section = ...

local width = wdg:option(Value, "width", translate("Width"))
width.rmempty = true

local height = wdg:option(Value, "height", translate("Height"))
height.rmempty = true

local pr = wdg:option(Value, "paddingright", translate("Padding right"))
pr.rmempty = true
