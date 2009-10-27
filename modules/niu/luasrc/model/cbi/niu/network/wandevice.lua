--[[
LuCI - Lua Configuration Interface

Copyright 2009 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--

local cursor = require "luci.model.uci".cursor()
local nw = require "luci.model.network"
nw.init(cursor)

f = Form("wandev", "Internet Device")
l = f:field(ListValue, "device", "Gerät")
l:value("ethernet:eth0", "Ethernet / Cable / DSL (eth0)")
l:value("none", "No Internet Connection")

function f.handle(self, state, data)
	if state == FORM_VALID then
		
	end
end

return f
