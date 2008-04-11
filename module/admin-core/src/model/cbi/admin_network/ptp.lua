-- ToDo: Translate, Add descriptions and help texts
m = Map("network", "Punkt-zu-Punkt Verbindungen")

s = m:section(TypedSection, "interface")
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

s:option(Value, "keepalive", "Keep-Alive").optional = true

s:option(Value, "demand", "Dial on Demand (idle time)").optional = true

srv = s:option(Value, "server", "PPTP-Server")
srv:depends("proto", "pptp")
srv.optional = true

mtu = s:option(Value, "mtu", "MTU")
mtu.optional = true
mtu.isinteger = true

return m