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

local fs = require "nixio.fs"
local nw = require "luci.model.network"

local has_ipv6 = nw:has_ipv6()
local has_pptp  = fs.access("/usr/sbin/pptp")
local has_pppd  = fs.access("/usr/sbin/pppd")
local has_pppoe = fs.glob("/usr/lib/pppd/*/rp-pppoe.so")()
local has_pppoa = fs.glob("/usr/lib/pppd/*/pppoatm.so")()


m = Map("network", translate("m_n_internet"))
nw.init(m.uci)

s = m:section(NamedSection, "wan", "interface")
s.addremove = false

s:tab("general", translate("niu_general", "General Settings"))
s:tab("expert", translate("niu_expert", "Expert Settings"))

p = s:taboption("general", ListValue, "proto", translate("protocol"))
p.override_scheme = true
p.default = "static"
p:value("static", translate("static"))
p:value("dhcp", "DHCP")
if has_pppoe then p:value("pppoe", "PPPoE")   end
if has_pppoa then p:value("pppoa", "PPPoA")   end
if has_pptp  then p:value("pptp",  "PPTP")    end
p:value("none", translate("none"))



ipaddr = s:taboption("general", Value, "ipaddr", translate("ipaddress"))
ipaddr.rmempty = true
ipaddr:depends("proto", "static")

nm = s:taboption("general", Value, "netmask", translate("netmask"))
nm.rmempty = true
nm:depends("proto", "static")
nm:value("255.255.255.0")
nm:value("255.255.0.0")
nm:value("255.0.0.0")

gw = s:taboption("general", Value, "gateway", translate("gateway"))
gw:depends("proto", "static")
gw.rmempty = true

bcast = s:taboption("expert", Value, "bcast", translate("broadcast"))
bcast:depends("proto", "static")

if has_ipv6 then
	ip6addr = s:taboption("expert", Value, "ip6addr", translate("ip6address"), translate("cidr6"))
	ip6addr:depends("proto", "static")

	ip6gw = s:taboption("expert", Value, "ip6gw", translate("gateway6"))
	ip6gw:depends("proto", "static")
end

dns = s:taboption("expert", Value, "dns", translate("dnsserver"))
dns:depends("peerdns", "")

mtu = s:taboption("expert", Value, "mtu", "MTU")
mtu.isinteger = true

mac = s:taboption("expert", Value, "macaddr", translate("macaddress"))


srv = s:taboption("general", Value, "server", translate("network_interface_server"))
srv:depends("proto", "pptp")
srv.rmempty = true

if has_pppd or has_pppoe or has_pppoa or has_pptp then
	user = s:taboption("general", Value, "username", translate("username"))
	user.rmempty = true
	user:depends("proto", "pptp")
	user:depends("proto", "pppoe")
	user:depends("proto", "pppoa")

	pass = s:taboption("general", Value, "password", translate("password"))
	pass.rmempty = true
	pass.password = true
	pass:depends("proto", "pptp")
	pass:depends("proto", "pppoe")
	pass:depends("proto", "pppoa")

	ka = s:taboption("expert", Value, "keepalive",
	 translate("network_interface_keepalive"),
	 translate("network_interface_keepalive_desc")
	)
	ka.default = "5"
	ka:depends("proto", "pptp")
	ka:depends("proto", "pppoe")
	ka:depends("proto", "pppoa")

	demand = s:taboption("expert", Value, "demand",
	 translate("network_interface_demand"),
	 translate("network_interface_demand_desc")
	)
	demand:depends("proto", "pptp")
	demand:depends("proto", "pppoe")
	demand:depends("proto", "pppoa")
end

if has_pppoa then
	encaps = s:taboption("expert", ListValue, "encaps", translate("network_interface_encaps"))
	encaps:depends("proto", "pppoa")
	encaps:value("", translate("cbi_select"))
	encaps:value("vc", "VC")
	encaps:value("llc", "LLC")

	vpi = s:taboption("expert", Value, "vpi", "VPI")
	vpi:depends("proto", "pppoa")

	vci = s:taboption("expert", Value, "vci", "VCI")
	vci:depends("proto", "pppoa")
end

if has_pptp or has_pppd or has_pppoe or has_pppoa or has_3g then
--[[
	defaultroute = s:taboption("expert", Flag, "defaultroute",
	 translate("network_interface_defaultroute"),
	 translate("network_interface_defaultroute_desc")
	)
	defaultroute:depends("proto", "pppoa")
	defaultroute:depends("proto", "pppoe")
	defaultroute:depends("proto", "pptp")
	defaultroute.rmempty = false
	function defaultroute.cfgvalue(...)
		return ( AbstractValue.cfgvalue(...) or '1' )
	end
]]
	peerdns = s:taboption("expert", Flag, "peerdns",
	 translate("network_interface_peerdns"),
	 translate("network_interface_peerdns_desc")
	)
	peerdns:depends("proto", "pppoa")
	peerdns:depends("proto", "pppoe")
	peerdns:depends("proto", "pptp")
	peerdns.rmempty = false
	peerdns.default = "1"

	if has_ipv6 then
		ipv6 = s:taboption("expert", Flag, "ipv6", translate("network_interface_ipv6") )
		ipv6:depends("proto", "pppoa")
		ipv6:depends("proto", "pppoe")
		ipv6:depends("proto", "pptp")
	end
end

return m
