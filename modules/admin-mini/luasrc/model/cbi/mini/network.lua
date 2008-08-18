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
require("luci.tools.webadmin")
require("luci.sys")

m0 = Map("network", translate("network"))
m0.stateful = true
local netstat = luci.sys.net.deviceinfo()

m0.parse = function() end

s = m0:section(TypedSection, "interface", translate("status"))
s.template = "cbi/tblsection"
s.rowcolors = true

function s.filter(self, section)
	return section ~= "loopback" and section
end

hwaddr = s:option(DummyValue, "_hwaddr")
function hwaddr.cfgvalue(self, section)
	local ix = self.map:get(section, "ifname") or ""
	return luci.fs.readfile("/sys/class/net/" .. ix .. "/address") or "n/a"
end


s:option(DummyValue, "ipaddr", translate("ipaddress"))

s:option(DummyValue, "netmask", translate("netmask"))


txrx = s:option(DummyValue, "_txrx")

function txrx.cfgvalue(self, section)
	local ix = self.map:get(section, "ifname")
	
	local rx = netstat and netstat[ix] and netstat[ix][1]
	rx = rx and luci.tools.webadmin.byte_format(tonumber(rx)) or "-"
	
	local tx = netstat and netstat[ix] and netstat[ix][9]
	tx = tx and luci.tools.webadmin.byte_format(tonumber(tx)) or "-"
	
	return string.format("%s / %s", tx, rx)
end

errors = s:option(DummyValue, "_err")

function errors.cfgvalue(self, section)
	local ix = self.map:get(section, "ifname")
	
	local rx = netstat and netstat[ix] and netstat[ix][3]
	local tx = netstat and netstat[ix] and netstat[ix][11]
	
	rx = rx and tostring(rx) or "-"
	tx = tx and tostring(tx) or "-"
	
	return string.format("%s / %s", tx, rx)
end




m = Map("network", "")

s = m:section(NamedSection, "lan", "interface", translate("m_n_local"))
s:option(Value, "ipaddr", translate("ipaddress"))

nm = s:option(Value, "netmask", translate("netmask"))
nm:value("255.255.255.0")
nm:value("255.255.0.0")
nm:value("255.0.0.0")

gw = s:option(Value, "gateway", translate("gateway") .. translate("cbi_optional"))
gw.rmempty = true
dns = s:option(Value, "dns", translate("dnsserver") .. translate("cbi_optional"))
dns.rmempty = true


s = m:section(NamedSection, "wan", "interface", translate("m_n_inet"))
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

kea = s:option(Flag, "keepalive", translate("m_n_keepalive"))
kea:depends("proto", "pppoe")
kea:depends("proto", "pptp")
kea.rmempty = true
kea.enabled = "10"


cod = s:option(Value, "demand", translate("m_n_dialondemand"), "s")
cod:depends("proto", "pppoe")
cod:depends("proto", "pptp")
cod.rmempty = true

srv = s:option(Value, "server", translate("m_n_pptp_server"))
srv:depends("proto", "pptp")
srv.rmempty = true



return m0, m