--[[
LuCI - Lua Configuration Interface

Copyright 2009 Steven Barth <steven@midlink.org>
Copyright 2009 Jo-Philipp Wich <xm@subsignal.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--

local nw = require "luci.model.network"
local fw = require "luci.model.firewall"

local has_ipv6 = nw:has_ipv6()

m = Map("network", translate("interfaces"), translate("a_n_ifaces1"))
m:chain("firewall")

nw.init(m.uci)
fw.init(m.uci)

s = m:section(NamedSection, "lan", "interface")
s.addremove = false

s:tab("general", translate("niu_general", "General Settings"))

ipaddr = s:taboption("general", Value, "ipaddr", translate("ipaddress"))

nm = s:taboption("general", Value, "netmask", translate("netmask"))
nm:value("255.255.255.0")
nm:value("255.255.0.0")
nm:value("255.0.0.0")



s:tab("expert", translate("niu_expert", "Expert Settings"))

mac = s:taboption("expert", Value, "macaddr", translate("macaddress"))

mtu = s:taboption("expert", Value, "mtu", "MTU")
mtu.isinteger = true

dns = s:taboption("expert", Value, "dns", translate("dnsserver"))
dns:depends("peerdns", "")


gw = s:taboption("expert", Value, "gateway", translate("gateway"))
bcast = s:taboption("expert", Value, "bcast", translate("broadcast"))


if has_ipv6 then
	ip6addr = s:taboption("expert", Value, "ip6addr", translate("ip6address"), translate("cidr6"))
	ip6gw = s:taboption("expert", Value, "ip6gw", translate("gateway6"))
end


br = s:taboption("expert", Flag, "type", translate("a_n_i_bridge"), translate("a_n_i_bridge1"))
br.enabled = "bridge"
br.rmempty = true

stp = s:taboption("expert", Flag, "stp", translate("a_n_i_stp"),
	translate("a_n_i_stp1", "Enables the Spanning Tree Protocol on this bridge"))
stp:depends("type", "1")
stp.rmempty = true

ifname_single = s:taboption("expert", Value, "ifname_single", translate("interface"))
ifname_single.template = "cbi/network_ifacelist"
ifname_single.widget = "radio"
ifname_single.nobridges = true
ifname_single.rmempty = true
ifname_single:depends("type", "")

function ifname_single.cfgvalue(self, s)
	return self.map.uci:get("network", s, "ifname")
end

function ifname_single.write(self, s, val)
	local n = nw:get_network(s)
	if n then n:ifname(val) end
end


ifname_multi = s:taboption("expert", MultiValue, "ifname_multi", translate("interface"))
ifname_multi.template = "cbi/network_ifacelist"
ifname_multi.nobridges = true
ifname_multi.widget = "checkbox"
ifname_multi:depends("type", "1")
ifname_multi.cfgvalue = ifname_single.cfgvalue
ifname_multi.write = ifname_single.write

for _, d in ipairs(nw:get_interfaces()) do
	if not d:is_bridge() then
		ifname_single:value(d:name())
		ifname_multi:value(d:name())
	end
end




return m
