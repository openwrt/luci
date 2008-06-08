--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--
m = Map("network", "Punkt-zu-Punkt Verbindungen", [[Punkt-zu-Punkt Verbindungen
über PPPoE oder PPTP werden häufig dazu verwendet, um über DSL o.ä. Techniken eine
Verbindung zum Internetgateway eines Internetzugangsanbieters aufzubauen.]])

s = m:section(TypedSection, "interface", "")
s.addremove = true
s:depends("proto", "pppoe")
s:depends("proto", "pptp")

p = s:option(ListValue, "proto", "Protokoll")
p:value("pppoe", "PPPoE")
p:value("pptp", "PPTP")
p.default = "pppoe"

s:option(Value, "ifname", "Schnittstelle")

s:option(Value, "username", "Benutzername")
s:option(Value, "password", "Passwort")

s:option(Value, "keepalive", "Keep-Alive", "Bei einer Verbindungstrennung automatisch neu verbinden").optional = true

s:option(Value, "demand", "Dial on Demand (idle time)", "Zeit nach der die Verbindung bei Inaktivität getrennt wird").optional = true

srv = s:option(Value, "server", "PPTP-Server")
srv:depends("proto", "pptp")
srv.optional = true

mtu = s:option(Value, "mtu", "MTU")
mtu.optional = true
mtu.isinteger = true

return m