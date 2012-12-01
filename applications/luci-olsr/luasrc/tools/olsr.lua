--[[
LuCI - Lua Configuration Interface

Copyright 2011 Manuel Munz <freifunk at somakoma dot de>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0
]]--

module("luci.tools.olsr", package.seeall)

function etx_color(etx)
	local color = "#bb3333"
	if etx == 0 then
		color = "#bb3333"
	elseif etx < 2 then
		color = "#00cc00"
	elseif etx < 4 then
		color = "#ffcb05"
	elseif etx < 10 then
		color = "#ff6600"
	end
	return color
end

