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
m = Map("network", translate("Routes"), translate("a_n_routes1"))

local routes6 = luci.sys.net.routes6()
local bit = require "bit"

s = m:section(TypedSection, "route", translate("Static IPv4 Routes"))
s.addremove = true
s.anonymous = true

s.template  = "cbi/tblsection"

iface = s:option(ListValue, "interface", translate("Interface"))
luci.tools.webadmin.cbi_add_networks(iface)

s:option(Value, "target", translate("Target"), translate("Host-<abbr title=\"Internet Protocol Address\">IP</abbr> or Network"))
s:option(Value, "netmask", translate("<abbr title=\"Internet Protocol Version 4\">IPv4</abbr>-Netmask"), translate("if target is a network")).rmemepty = true
s:option(Value, "gateway", translate("<abbr title=\"Internet Protocol Version 4\">IPv4</abbr>-Gateway"))

if routes6 then
	s = m:section(TypedSection, "route6", translate("Static IPv6 Routes"))
	s.addremove = true
	s.anonymous = true

	s.template  = "cbi/tblsection"

	iface = s:option(ListValue, "interface", translate("Interface"))
	luci.tools.webadmin.cbi_add_networks(iface)

	s:option(Value, "target", translate("Target"), translate("<abbr title=\"Internet Protocol Version 6\">IPv6</abbr>-Address or Network (CIDR)"))
	s:option(Value, "gateway", translate("<abbr title=\"Internet Protocol Version 6\">IPv6</abbr>-Gateway")).rmempty = true
end


return m
