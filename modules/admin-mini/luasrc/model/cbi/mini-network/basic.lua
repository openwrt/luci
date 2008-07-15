--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>
Copyright 2008 Jo-Philipp Wich <xm@leipzig.freifunk.net>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--
m = Map("network", "Network")

s = m:section(NamedSection, "lan", "interface", "Local Network")
s:option(Value, "ipaddr", translate("ipaddress"))
s:option(Value, "netmask", translate("netmask"))
gw = s:option(Value, "gateway", translate("gateway"))
gw.rmempty = true
dns = s:option(Value, "dns", translate("dnsserver"))
dns.rmempty = true


s = m:section(NamedSection, "wan", "interface", "Internet Connection")
p = s:option(ListValue, "proto", translate("protocol"))
p:value("none", "disabled")
p:value("static", translate("manual", "manual"))
p:value("dhcp", translate("automatic", "automatic"))
p:value("pppoe", "PPPoE")
p:value("pptp", "PPTP")

ip = s:option(Value, "ipaddr", translate("ipaddress"))
ip:depends("proto", "static")

nm = s:option(Value, "netmask", translate("netmask"))
nm:depends("proto", "static")

gw = s:option(Value, "gateway", translate("gateway"))
gw:depends("proto", "static")
gw.rmempty = true

dns = s:option(Value, "dns", translate("dnsserver"))
dns:depends("proto", "static")
dns.rmempty = true

usr = s:option(Value, "username", translate("username"))
usr:depends("proto", "pppoe")
usr:depends("proto", "pptp")

pwd = s:option(Value, "password", translate("password"))
pwd:depends("proto", "pppoe")
pwd:depends("proto", "pptp")

kea = s:option(Value, "keepalive", "Keep-Alive")
kea:depends("proto", "pppoe")
kea:depends("proto", "pptp")
kea.rmempty = true


cod = s:option(Value, "demand", "Dial on Demand")
cod:depends("proto", "pppoe")
cod:depends("proto", "pptp")
cod.rmempty = true

srv = s:option(Value, "server", "PPTP-Server")
srv:depends("proto", "pptp")
srv.rmempty = true

mtu = s:option(Value, "mtu", "MTU")
mtu:depends("proto", "static")
mtu:depends("proto", "dhcp")
mtu:depends("proto", "pppoe")
mtu:depends("proto", "pptp")
mtu.rmempty = true



return m