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
function s.filter(section)
	return section ~= "loopback" and (not arg or #arg == 0 or
	 luci.util.contains(arg, section))
end

if not arg or #arg == 0 then
	s.addremove = true
end
s:depends("proto", "static")
s:depends("proto", "dhcp")

p = s:option(ListValue, "proto", translate("protocol"))
p:value("static", translate("static"))
p:value("dhcp", "DHCP")
p.default = "static"

br = s:option(Flag, "type", translate("a_n_i_bridge"), translate("a_n_i_bridge1"))
br.enabled = "bridge"
br.rmempty = true

ifname = s:option(Value, "ifname", translate("interface"))
ifname.rmempty = true
for i,d in ipairs(luci.sys.net.devices()) do
	if d ~= "lo" then
		ifname:value(d)
	end
end

ipaddr = s:option(Value, "ipaddr", translate("ipaddress"))
ipaddr.rmempty = true
ipaddr:depends("proto", "static")

nm = s:option(Value, "netmask", translate("netmask"))
nm.rmempty = true
nm:depends("proto", "static")
nm:value("255.255.255.0")
nm:value("255.255.0.0")
nm:value("255.0.0.0")

gw = s:option(Value, "gateway", translate("gateway"))
gw:depends("proto", "static")
gw.rmempty = true

ip6addr = s:option(Value, "ip6addr", translate("ip6address"), translate("cidr6"))
ip6addr.rmempty = true
ip6addr:depends("proto", "static")

ip6gw = s:option(Value, "ip6gw", translate("gateway6"))
ip6gw:depends("proto", "static")
ip6gw.rmempty = true

dns = s:option(Value, "dns", translate("dnsserver"))
dns:depends("proto", "static")
dns.optional = true

mtu = s:option(Value, "mtu", "MTU")
mtu.optional = true
mtu.isinteger = true

mac = s:option(Value, "macaddr", translate("macaddress"))
mac.optional = true

return m