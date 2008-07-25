--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--
m = Map("network", translate("interfaces"), translate("a_n_ifaces1"))

s = m:section(TypedSection, "interface", "")
s.addremove = true
s:exclude("loopback")
s:depends("proto", "static")
s:depends("proto", "dhcp")

p = s:option(ListValue, "proto", translate("protocol"))
p:value("static", translate("static"))
p:value("dhcp", "DHCP")
p.default = "static"

br = s:option(Flag, "type", translate("a_n_i_bridge"), translate("a_n_i_bridge1"))
br.enabled = "bridge"
br.rmempty = true

s:option(Value, "ifname", translate("interface")).rmempty = true

s:option(Value, "ipaddr", translate("ipaddress"))

s:option(Value, "netmask", translate("netmask")):depends("proto", "static")

gw = s:option(Value, "gateway", translate("gateway"))
gw:depends("proto", "static")
gw.rmempty = true

dns = s:option(Value, "dns", translate("dnsserver"))
dns:depends("proto", "static")
dns.optional = true

mtu = s:option(Value, "mtu", "MTU")
mtu.optional = true
mtu.isinteger = true

mac = s:option(Value, "macaddr", translate("macaddress"))
mac.optional = true

return m