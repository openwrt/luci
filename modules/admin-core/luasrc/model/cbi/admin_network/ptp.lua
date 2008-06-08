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

p = s:option(ListValue, "proto", translate("protocol", "Protokoll"))
p:value("pppoe", "PPPoE")
p:value("pptp", "PPTP")
p.default = "pppoe"

s:option(Value, "ifname", translate("interface", "Schnittstelle"))

s:option(Value, "username", translate("username", "Benutzername"))
s:option(Value, "password", translate("password", "Passwort"))

s:option(Value, "keepalive").optional = true

s:option(Value, "demand").optional = true

srv = s:option(Value, "server")
srv:depends("proto", "pptp")
srv.optional = true

mtu = s:option(Value, "mtu", "MTU")
mtu.optional = true
mtu.isinteger = true

return m