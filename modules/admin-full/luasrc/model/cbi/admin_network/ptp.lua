--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--
m = Map("network", translate("a_n_ptp"), translate("a_n_ptp1"))

s = m:section(TypedSection, "interface", "")
s.addremove = true
s:depends("proto", "pppoe")
s:depends("proto", "pptp")

p = s:option(ListValue, "proto", translate("protocol"))
p:value("pppoe", "PPPoE")
p:value("pptp", "PPTP")
p.default = "pppoe"

ifname = s:option(Value, "ifname", translate("interface"))
for i,d in ipairs(luci.sys.net.devices()) do
	if d ~= "lo" then
		ifname:value(d)
	end
end

s:option(Value, "username", translate("username"))
s:option(Value, "password", translate("password"))

s:option(Value, "keepalive").optional = true

s:option(Value, "demand").optional = true

srv = s:option(Value, "server")
srv:depends("proto", "pptp")
srv.rmempty = true

mtu = s:option(Value, "mtu", "MTU")
mtu.optional = true
mtu.isinteger = true

return m