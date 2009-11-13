--[[
LuCI - Lua Configuration Interface

Copyright 2009 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--

local cursor = require "luci.model.uci".inst_state
local nw = require "luci.model.network"
nw.init(cursor)

m = Map("network", "Configure Internet Connection")
s = m:section(NamedSection, "wan", "interface", "Internet Connection Device")
s.anonymous = true
s.addremove = false

l = s:option(ListValue, "_wandev", "Internet Connection via")

for _, iface in ipairs(nw.get_interfaces()) do
	if iface:name():find("eth") == 1 then
		local net = iface:get_network()
		if not net or net:name() == "wan" or os.getenv("LUCI_SYSROOT") then
			l:value("ethernet:%s" % iface:name(),
				"Cable / DSL / Ethernet Adapter (%s)" % iface:name())
		end
	end
end

l:value("none", "No Internet Connection")

return m
