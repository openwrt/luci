--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--

require("luci.tools.webadmin")
m = Map("network", translate("a_n_routes"), translate("a_n_routes1"))

local routes = luci.sys.net.routes()
local routes6 = luci.sys.net.routes6()
local bit = require "bit"

v = m:section(Table, routes, translate("a_n_routes_kernel4"))

net = v:option(DummyValue, "iface", translate("network"))
function net.cfgvalue(self, section)
	return luci.tools.webadmin.iface_get_network(routes[section].device)
	 or routes[section].device
end

target  = v:option(DummyValue, "target", translate("target"))
function target.cfgvalue(self, section)
	return routes[section].dest:network():string()
end

netmask = v:option(DummyValue, "netmask", translate("netmask"))
function netmask.cfgvalue(self, section)
	return routes[section].dest:mask():string()
end

gateway = v:option(DummyValue, "gateway", translate("gateway"))
function gateway.cfgvalue(self, section)
	return routes[section].gateway:string()
end

metric = v:option(DummyValue, "metric", translate("metric"))
function metric.cfgvalue(self, section)
	return routes[section].metric
end

if routes6 then
	v = m:section(Table, routes6, translate("a_n_routes_kernel6"))

	net = v:option(DummyValue, "iface", translate("network"))
	function net.cfgvalue(self, section)
		return luci.tools.webadmin.iface_get_network(routes6[section].device)
		 or routes6[section].device
	end

	target  = v:option(DummyValue, "target", translate("target"))
	function target.cfgvalue(self, section)
		return routes6[section].dest:string()
	end

	gateway = v:option(DummyValue, "gateway", translate("gateway6"))
	function gateway.cfgvalue(self, section)
		return routes6[section].source:string()
	end

	metric = v:option(DummyValue, "metric", translate("metric"))
	function metric.cfgvalue(self, section)
		local metr = routes6[section].metric
		local lower = bit.band(metr, 0xffff)
		local higher = bit.rshift(bit.band(metr, 0xffff0000), 16)
		return "%04X%04X" % {higher, lower}
	end
end


return m
