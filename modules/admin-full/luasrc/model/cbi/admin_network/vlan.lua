--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--
m = Map("network", translate("a_n_switch"), translate("a_n_switch1"))

s = m:section(TypedSection, "switch", "")

for i = 0, 15 do
	s:option(Value, "vlan"..i, "ethX."..i).optional = true
end

return m