--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--
m = Map("network", "Schnittstellen", [[An dieser Stelle können die einzelnen Schnittstellen 
des Netzwerkes konfiguriert werden. Es können mehrere Schnittstellen zu einer Brücke zusammengefasst werden,
indem diese durch Leerzeichen getrennt aufgezählt werden und ein entsprechender Haken im Feld Netzwerkbrücke
gesetzt wird. Es können VLANs in der Notation SCHNITTSTELLE.VLANNR (z.B.: eth0.1) verwendet werden.]])

s = m:section(TypedSection, "interface", "")
s.addremove = true
s:exclude("loopback")
s:depends("proto", "static")
s:depends("proto", "dhcp")

p = s:option(ListValue, "proto", "Protokoll")
p:value("static", "statisch")
p:value("dhcp", "DHCP")
p.default = "static"

br = s:option(Flag, "type", "Netzwerkbrücke", "überbrückt angegebene Schnittstelle(n)")
br.enabled = "bridge"
br.rmempty = true

s:option(Value, "ifname", "Schnittstelle")

s:option(Value, "ipaddr", "IP-Adresse")

s:option(Value, "netmask", "Netzmaske"):depends("proto", "static")

gw = s:option(Value, "gateway", "Gateway")
gw:depends("proto", "static")
gw.rmempty = true

dns = s:option(Value, "dns", "DNS-Server")
dns:depends("proto", "static")
dns.optional = true

mtu = s:option(Value, "mtu", "MTU")
mtu.optional = true
mtu.isinteger = true

mac = s:option(Value, "macaddr", "MAC-Adresse")
mac.optional = true

return m