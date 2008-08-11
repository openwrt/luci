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

arg = arg or {}

s = m:section(TypedSection, "interface", translate("interfaces"))
function s.create(self, section)
	local stat = TypedSection.create(self, section)
	if stat then
		arg = {section or stat}
	end
	return stat
end

function s.filter(self, section)
	return section ~= "loopback" and
	 (not arg or not arg[1] or arg[1] == section)
end

if not arg or not arg[1] then
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

bcast = s:option(Value, "bcast", translate("broadcast"))
bcast:depends("proto", "static")
bcast.optional = true

ip6addr = s:option(Value, "ip6addr", translate("ip6address"), translate("cidr6"))
ip6addr.optional = true
ip6addr:depends("proto", "static")

ip6gw = s:option(Value, "ip6gw", translate("gateway6"))
ip6gw:depends("proto", "static")
ip6gw.optional = true

dns = s:option(Value, "dns", translate("dnsserver"))
dns:depends("proto", "static")
dns.optional = true

mtu = s:option(Value, "mtu", "MTU")
mtu.optional = true
mtu.isinteger = true

mac = s:option(Value, "macaddr", translate("macaddress"))
mac.optional = true




s2 = m:section(TypedSection, "alias", translate("aliases"))
s2.addremove = true

if arg and arg[1] then
	s2:depends("interface", arg[1])
	s2.defaults.interface = arg[1]
else
	parent = s2:option(ListValue, "interface", translate("interface"))
	luci.model.uci.foreach("network", "interface",
		function (section)
			if section[".name"] ~= "loopback" then
				parent:value(section[".name"])
			end
		end
	)
end


s2.defaults.proto = "static"

ipaddr = s2:option(Value, "ipaddr", translate("ipaddress"))
ipaddr.rmempty = true

nm = s2:option(Value, "netmask", translate("netmask"))
nm.rmempty = true
nm:value("255.255.255.0")
nm:value("255.255.0.0")
nm:value("255.0.0.0")

gw = s2:option(Value, "gateway", translate("gateway"))
gw.rmempty = true

bcast = s2:option(Value, "bcast", translate("broadcast"))
bcast.optional = true

ip6addr = s2:option(Value, "ip6addr", translate("ip6address"), translate("cidr6"))
ip6addr.optional = true

ip6gw = s2:option(Value, "ip6gw", translate("gateway6"))
ip6gw.optional = true

dns = s2:option(Value, "dns", translate("dnsserver"))
dns.optional = true

return m
