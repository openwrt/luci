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

local has_ipv6  = fs.access("/proc/net/ipv6_route")
local has_pptp  = fs.access("/usr/sbin/pptp")
local has_pppd  = fs.access("/usr/sbin/pppd")
local has_pppoe = fs.glob("/usr/lib/pppd/*/rp-pppoe.so")()
local has_pppoa = fs.glob("/usr/lib/pppd/*/pppoatm.so")()


m = Map("network", "Configure Ethernet Adapter for Internet Connection")

s = m:section(NamedSection, "wan", "interface")
s.addremove = false

s:tab("general", translate("General Settings"))
s:tab("expert", translate("Expert Settings"))

p = s:taboption("general", ListValue, "proto", translate("Connection Protocol"))
p.override_scheme = true
p.default = "dhcp"
p:value("dhcp", translate("Cable / Ethernet / DHCP"))
if has_pppoe then p:value("pppoe", "DSL / PPPoE")   end
if has_pppoa then p:value("pppoa", "PPPoA")   end
if has_pptp  then p:value("pptp",  "PPTP")    end
p:value("static", translate("Static Ethernet"))



ipaddr = s:taboption("general", Value, "ipaddr", translate("<abbr title=\"Internet Protocol Version 4\">IPv4</abbr>-Address"))
ipaddr.rmempty = true
ipaddr:depends("proto", "static")

nm = s:taboption("general", Value, "netmask", translate("<abbr title=\"Internet Protocol Version 4\">IPv4</abbr>-Netmask"))
nm.rmempty = true
nm:depends("proto", "static")
nm:value("255.255.255.0")
nm:value("255.255.0.0")
nm:value("255.0.0.0")

gw = s:taboption("general", Value, "gateway", translate("<abbr title=\"Internet Protocol Version 4\">IPv4</abbr>-Gateway"))
gw:depends("proto", "static")
gw.rmempty = true

bcast = s:taboption("expert", Value, "bcast", translate("<abbr title=\"Internet Protocol Version 4\">IPv4</abbr>-Broadcast"))
bcast:depends("proto", "static")

if has_ipv6 then
	ip6addr = s:taboption("expert", Value, "ip6addr", translate("<abbr title=\"Internet Protocol Version 6\">IPv6</abbr>-Address"), translate("<abbr title=\"Classless Inter-Domain Routing\">CIDR</abbr>-Notation: address/prefix"))
	ip6addr:depends("proto", "static")

	ip6gw = s:taboption("expert", Value, "ip6gw", translate("<abbr title=\"Internet Protocol Version 6\">IPv6</abbr>-Gateway"))
	ip6gw:depends("proto", "static")
end

dns = s:taboption("expert", Value, "dns", translate("<abbr title=\"Domain Name System\">DNS</abbr>-Server"))
dns:depends("peerdns", "")

mtu = s:taboption("expert", Value, "mtu", "MTU")
mtu.isinteger = true

mac = s:taboption("expert", Value, "macaddr", translate("<abbr title=\"Media Access Control\">MAC</abbr>-Address"))


srv = s:taboption("general", Value, "server", translate("<abbr title=\"Point-to-Point Tunneling Protocol\">PPTP</abbr>-Server"))
srv:depends("proto", "pptp")
srv.rmempty = true

if has_pppd or has_pppoe or has_pppoa or has_pptp then
	user = s:taboption("general", Value, "username", translate("Username"))
	user.rmempty = true
	user:depends("proto", "pptp")
	user:depends("proto", "pppoe")
	user:depends("proto", "pppoa")

	pass = s:taboption("general", Value, "password", translate("Password"))
	pass.rmempty = true
	pass.password = true
	pass:depends("proto", "pptp")
	pass:depends("proto", "pppoe")
	pass:depends("proto", "pppoa")

	ka = s:taboption("expert", Value, "keepalive",
	 translate("Keep-Alive"),
	 translate("Number of failed connection tests to initiate automatic reconnect")
	)
	ka.default = "5"
	ka:depends("proto", "pptp")
	ka:depends("proto", "pppoe")
	ka:depends("proto", "pppoa")

	demand = s:taboption("expert", Value, "demand",
	 translate("Automatic Disconnect"),
	 translate("Time (in seconds) after which an unused connection will be closed")
	)
	demand:depends("proto", "pptp")
	demand:depends("proto", "pppoe")
	demand:depends("proto", "pppoa")
end

if has_pppoa then
	encaps = s:taboption("expert", ListValue, "encaps", translate("PPPoA Encapsulation"))
	encaps:depends("proto", "pppoa")
	encaps:value("", translate("-- Please choose --"))
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
	 translate("Replace default route"),
	 translate("Let pppd replace the current default route to use the PPP interface after successful connect")
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
	 translate("Use peer DNS"),
	 translate("Configure the local DNS server to use the name servers adverticed by the PPP peer")
	)
	peerdns:depends("proto", "pppoa")
	peerdns:depends("proto", "pppoe")
	peerdns:depends("proto", "pptp")
	peerdns.rmempty = false
	peerdns.default = "1"

	if has_ipv6 then
		ipv6 = s:taboption("expert", Flag, "ipv6", translate("Enable IPv6 on PPP link") )
		ipv6:depends("proto", "pppoa")
		ipv6:depends("proto", "pppoe")
		ipv6:depends("proto", "pptp")
	end
end

return m
