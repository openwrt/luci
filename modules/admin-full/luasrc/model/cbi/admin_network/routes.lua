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

local routes6 = luci.sys.net.routes6()

if not arg or not arg[1] then
	local routes = luci.sys.net.routes()

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

	metric = v:option(DummyValue, "Metric", translate("metric"))

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

		metric = v:option(DummyValue, "Metric", translate("metric"))
	    function metric.cfgvalue(self, section)
	        return string.format( "%08X", routes6[section].metric )
	    end
	end
end


s = m:section(TypedSection, "route", translate("a_n_routes_static4"))
s.addremove = true
s.anonymous = true

s.template  = "cbi/tblsection"

iface = s:option(ListValue, "interface", translate("interface"))
luci.tools.webadmin.cbi_add_networks(iface)

if not arg or not arg[1] then
	net.titleref = iface.titleref
end

s:option(Value, "target", translate("target"), translate("a_n_r_target1"))

s:option(Value, "netmask", translate("netmask"), translate("a_n_r_netmask1")).rmemepty = true

s:option(Value, "gateway", translate("gateway"))

if routes6 then
	s = m:section(TypedSection, "route6", translate("a_n_routes_static6"))
	s.addremove = true
	s.anonymous = true

	s.template  = "cbi/tblsection"

	iface = s:option(ListValue, "interface", translate("interface"))
	luci.tools.webadmin.cbi_add_networks(iface)

	if not arg or not arg[1] then
		net.titleref = iface.titleref
	end

	s:option(Value, "target", translate("target"), translate("a_n_r_target6"))

	s:option(Value, "gateway", translate("gateway6")).rmempty = true
end


return m
