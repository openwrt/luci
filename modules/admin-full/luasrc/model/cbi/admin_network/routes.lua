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

if not arg or not arg[1] then
	local routes = luci.sys.net.routes()
	
	v = m:section(Table, routes, translate("a_n_routes_kernel4"))
	
	net = v:option(DummyValue, "iface", translate("network"))
	function net.cfgvalue(self, section)
		return luci.tools.webadmin.iface_get_network(routes[section].Iface)
		 or routes[section].Iface
	end
	
	target  = v:option(DummyValue, "target", translate("target"))
	function target.cfgvalue(self, section)
		return luci.ip.Hex(routes[section].Destination, 32):string()
	end
	
	netmask = v:option(DummyValue, "netmask", translate("netmask"))
	function netmask.cfgvalue(self, section)
		return luci.ip.Hex(routes[section].Mask, 32):string()
	end
	
	gateway = v:option(DummyValue, "gateway", translate("gateway"))
	function gateway.cfgvalue(self, section)
		return luci.ip.Hex(routes[section].Gateway, 32):string()
	end
	
	metric = v:option(DummyValue, "Metric", translate("metric"))
end


s = m:section(TypedSection, "route", translate("a_n_routes_static"))
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

return m