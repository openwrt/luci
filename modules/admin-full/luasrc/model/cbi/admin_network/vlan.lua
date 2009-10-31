--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--
m = Map("network", translate("Switch"), translate("The network ports on your router can be combined to several <abbr title=\"Virtual Local Area Network\">VLAN</abbr>s in which computers can communicate directly with each other. <abbr title=\"Virtual Local Area Network\">VLAN</abbr>s are often used to separate different network segments. Often there is by default one Uplink port for a connection to the next greater network like the internet and other ports for a local network."))

s = m:section(TypedSection, "switch", "")

for i = 0, 15 do
	s:option(Value, "vlan"..i, "ethX."..i).optional = true
end

return m