--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>
Copyright 2008 Jo-Philipp Wich <xm@subsignal.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--

local fs = require "nixio.fs"
local nw = require "luci.model.network"
local fw = require "luci.model.firewall"

arg[1] = arg[1] or ""

local has_3g    = fs.access("/usr/bin/gcom")
local has_pptp  = fs.access("/usr/sbin/pptp")
local has_pppd  = fs.access("/usr/sbin/pppd")
local has_pppoe = fs.glob("/usr/lib/pppd/*/rp-pppoe.so")()
local has_pppoa = fs.glob("/usr/lib/pppd/*/pppoatm.so")()
local has_ipv6  = fs.access("/proc/net/ipv6_route")

m = Map("network", translate("interfaces"), translate("a_n_ifaces1"))
m:chain("firewall")

nw.init(m.uci)
fw.init(m.uci)

s = m:section(NamedSection, arg[1], "interface")
s.addremove = true

s:tab("general", translate("a_n_general", "General Setup"))
if has_ipv6 then s:tab("ipv6", translate("a_n_ipv6", "IPv6 Setup")) end
s:tab("physical", translate("a_n_physical", "Physical Settings"))

--[[
back = s:taboption("general", DummyValue, "_overview", translate("overview"))
back.value = ""
back.titleref = luci.dispatcher.build_url("admin", "network", "network")
]]

p = s:taboption("general", ListValue, "proto", translate("protocol"))
p.override_scheme = true
p.default = "static"
p:value("static", translate("static"))
p:value("dhcp", "DHCP")
if has_pppd  then p:value("ppp",   "PPP")     end
if has_pppoe then p:value("pppoe", "PPPoE")   end
if has_pppoa then p:value("pppoa", "PPPoA")   end
if has_3g    then p:value("3g",    "UMTS/3G") end
if has_pptp  then p:value("pptp",  "PPTP")    end
p:value("none", translate("none"))

if not ( has_pppd and has_pppoe and has_pppoa and has_3g and has_pptp ) then
	p.description = translate("network_interface_prereq")
end

br = s:taboption("physical", Flag, "type", translate("a_n_i_bridge"), translate("a_n_i_bridge1"))
br.enabled = "bridge"
br.rmempty = true

stp = s:taboption("physical", Flag, "stp", translate("a_n_i_stp"),
	translate("a_n_i_stp1", "Enables the Spanning Tree Protocol on this bridge"))
stp:depends("type", "1")
stp.rmempty = true

ifname_single = s:taboption("physical", Value, "ifname_single", translate("interface"))
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


ifname_multi = s:taboption("physical", MultiValue, "ifname_multi", translate("interface"))
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


fwzone = s:taboption("general", Value, "_fwzone",
	translate("network_interface_fwzone"),
	translate("network_interface_fwzone_desc"))

fwzone.template = "cbi/firewall_zonelist"
fwzone.rmempty = false

function fwzone.cfgvalue(self, section)
	self.iface = section
	local z = fw:get_zones_by_network(section)[1]
	return z and z:name()
end

function fwzone.write(self, section, value)
	local zone = fw:get_zone(value)

	if not zone and value == '-' then
		value = m:formvalue(self:cbid(section) .. ".newzone")
		if value and #value > 0 then
			zone = fw:add_zone(value)
		else
			fw:del_network(section)
		end
	end

	if zone then
		fw:del_network(section)
		zone:add_network(section)
	end
end

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

bcast = s:taboption("general", Value, "bcast", translate("broadcast"))
bcast:depends("proto", "static")

if has_ipv6 then
	ip6addr = s:taboption("ipv6", Value, "ip6addr", translate("ip6address"), translate("cidr6"))
	ip6addr:depends("proto", "static")

	ip6gw = s:taboption("ipv6", Value, "ip6gw", translate("gateway6"))
	ip6gw:depends("proto", "static")
end

dns = s:taboption("general", Value, "dns", translate("dnsserver"))
dns:depends("peerdns", "")

mtu = s:taboption("physical", Value, "mtu", "MTU")
mtu.isinteger = true

mac = s:taboption("physical", Value, "macaddr", translate("macaddress"))


srv = s:taboption("general", Value, "server", translate("network_interface_server"))
srv:depends("proto", "pptp")
srv.rmempty = true

if has_3g then
	service = s:taboption("general", ListValue, "service", translate("network_interface_service"))
	service:value("", translate("cbi_select"))
	service:value("umts", "UMTS/GPRS")
	service:value("cdma", "CDMA")
	service:value("evdo", "EV-DO")
	service:depends("proto", "3g")
	service.rmempty = true

	apn = s:taboption("general", Value, "apn", translate("network_interface_apn"))
	apn:depends("proto", "3g")

	pincode = s:taboption("general", Value, "pincode",
	 translate("network_interface_pincode"),
	 translate("network_interface_pincode_desc")
	)
	pincode:depends("proto", "3g")
end

if has_pppd or has_pppoe or has_pppoa or has_3g or has_pptp then
	user = s:taboption("general", Value, "username", translate("username"))
	user.rmempty = true
	user:depends("proto", "pptp")
	user:depends("proto", "pppoe")
	user:depends("proto", "pppoa")
	user:depends("proto", "ppp")
	user:depends("proto", "3g")

	pass = s:taboption("general", Value, "password", translate("password"))
	pass.rmempty = true
	pass.password = true
	pass:depends("proto", "pptp")
	pass:depends("proto", "pppoe")
	pass:depends("proto", "pppoa")
	pass:depends("proto", "ppp")
	pass:depends("proto", "3g")

	ka = s:taboption("general", Value, "keepalive",
	 translate("network_interface_keepalive"),
	 translate("network_interface_keepalive_desc")
	)
	ka:depends("proto", "pptp")
	ka:depends("proto", "pppoe")
	ka:depends("proto", "pppoa")
	ka:depends("proto", "ppp")
	ka:depends("proto", "3g")

	demand = s:taboption("general", Value, "demand",
	 translate("network_interface_demand"),
	 translate("network_interface_demand_desc")
	)
	demand:depends("proto", "pptp")
	demand:depends("proto", "pppoe")
	demand:depends("proto", "pppoa")
	demand:depends("proto", "ppp")
	demand:depends("proto", "3g")
end

if has_pppoa then
	encaps = s:taboption("general", ListValue, "encaps", translate("network_interface_encaps"))
	encaps:depends("proto", "pppoa")
	encaps:value("", translate("cbi_select"))
	encaps:value("vc", "VC")
	encaps:value("llc", "LLC")

	vpi = s:taboption("general", Value, "vpi", "VPI")
	vpi:depends("proto", "pppoa")

	vci = s:taboption("general", Value, "vci", "VCI")
	vci:depends("proto", "pppoa")
end

if has_pptp or has_pppd or has_pppoe or has_pppoa or has_3g then
	device = s:taboption("general", Value, "device",
	 translate("network_interface_device"),
	 translate("network_interface_device_desc")
	)
	device:depends("proto", "ppp")
	device:depends("proto", "3g")

	defaultroute = s:taboption("general", Flag, "defaultroute",
	 translate("network_interface_defaultroute"),
	 translate("network_interface_defaultroute_desc")
	)
	defaultroute:depends("proto", "ppp")
	defaultroute:depends("proto", "pppoa")
	defaultroute:depends("proto", "pppoe")
	defaultroute:depends("proto", "pptp")
	defaultroute:depends("proto", "3g")
	defaultroute.rmempty = false
	function defaultroute.cfgvalue(...)
		return ( AbstractValue.cfgvalue(...) or '1' )
	end

	peerdns = s:taboption("general", Flag, "peerdns",
	 translate("network_interface_peerdns"),
	 translate("network_interface_peerdns_desc")
	)
	peerdns:depends("proto", "ppp")
	peerdns:depends("proto", "pppoa")
	peerdns:depends("proto", "pppoe")
	peerdns:depends("proto", "pptp")
	peerdns:depends("proto", "3g")
	peerdns.rmempty = false
	function peerdns.cfgvalue(...)
		return ( AbstractValue.cfgvalue(...) or '1' )
	end

	if has_ipv6 then
		ipv6 = s:taboption("general", Flag, "ipv6", translate("network_interface_ipv6") )
		ipv6:depends("proto", "ppp")
		ipv6:depends("proto", "pppoa")
		ipv6:depends("proto", "pppoe")
		ipv6:depends("proto", "pptp")
		ipv6:depends("proto", "3g")
	end

	connect = s:taboption("general", Value, "connect",
	 translate("network_interface_connect"),
	 translate("network_interface_connect_desc")
	)
	connect:depends("proto", "ppp")
	connect:depends("proto", "pppoe")
	connect:depends("proto", "pppoa")
	connect:depends("proto", "pptp")
	connect:depends("proto", "3g")

	disconnect = s:taboption("general", Value, "disconnect",
	 translate("network_interface_disconnect"),
	 translate("network_interface_disconnect_desc")
	)
	disconnect:depends("proto", "ppp")
	disconnect:depends("proto", "pppoe")
	disconnect:depends("proto", "pppoa")
	disconnect:depends("proto", "pptp")
	disconnect:depends("proto", "3g")

	pppd_options = s:taboption("general", Value, "pppd_options",
	 translate("network_interface_pppd_options"),
	 translate("network_interface_pppd_options_desc")
	)
	pppd_options:depends("proto", "ppp")
	pppd_options:depends("proto", "pppoa")
	pppd_options:depends("proto", "pppoe")
	pppd_options:depends("proto", "pptp")
	pppd_options:depends("proto", "3g")

	maxwait = s:taboption("general", Value, "maxwait",
	 translate("network_interface_maxwait"),
	 translate("network_interface_maxwait_desc")
	)
	maxwait:depends("proto", "3g")
end

s2 = m:section(TypedSection, "alias", translate("aliases"))
s2.addremove = true

s2:depends("interface", arg[1])
s2.defaults.interface = arg[1]


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
