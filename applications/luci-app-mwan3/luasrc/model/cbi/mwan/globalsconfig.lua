--[[
LuCI - Lua Configuration Interface

Copyright 2017 Florian Eckert <fe@dev.tdt.de>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--

local net = require "luci.model.network".init()

m = Map("mwan3")

s = m:section(NamedSection, "globals", "globals", translate("Globals mwan3 options"))
n = s:option(ListValue, "local_source",
	translate("Local source interface"),
	translate("Use the IP address of this interface as source IP address for traffic initiated by the router itself"))
n:value("none")
n.default = "none"
for _, net in ipairs(net:get_networks()) do
	if net:name() ~= "loopback" then
		n:value(net:name())
	end
end
n.rmempty = false

mask = s:option(
	Value,
	"mmx_mask",
	translate("Firewall mask"),
	translate("Enter value in hex, starting with <code>0x</code>"))
mask.datatype = "hex(4)"
mask.default = "0xff00"

return m
