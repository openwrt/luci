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
require("luci.fs")

local has_pptp  = luci.fs.mtime("/usr/sbin/pptp")
local has_pppoe = luci.fs.glob("/usr/lib/pppd/*/rp-pppoe.so")

local network = luci.model.uci.cursor_state():get_all("network")

local netstat = luci.sys.net.deviceinfo()
local ifaces = {}

for k, v in pairs(network) do
	if v[".type"] == "interface" and k ~= "loopback" then
		table.insert(ifaces, v)
	end
end

m = Map("network", translate("network"))
s = m:section(Table, ifaces, translate("status"))
s.parse = function() end

s:option(DummyValue, ".name", translate("network"))

hwaddr = s:option(DummyValue, "_hwaddr",
 translate("network_interface_hwaddr"), translate("network_interface_hwaddr_desc"))
function hwaddr.cfgvalue(self, section)
	local ix = self.map:get(section, "ifname") or ""
	return luci.fs.readfile("/sys/class/net/" .. ix .. "/address")
		or luci.util.exec("ifconfig " .. ix):match(" ([A-F0-9:]+)%s*\n")
		or "n/a"
end


s:option(DummyValue, "ipaddr", translate("ipaddress"))

s:option(DummyValue, "netmask", translate("netmask"))


txrx = s:option(DummyValue, "_txrx",
 translate("network_interface_txrx"), translate("network_interface_txrx_desc"))

function txrx.cfgvalue(self, section)
	local ix = self.map:get(section, "ifname")

	local rx = netstat and netstat[ix] and netstat[ix][1]
	rx = rx and luci.tools.webadmin.byte_format(tonumber(rx)) or "-"

	local tx = netstat and netstat[ix] and netstat[ix][9]
	tx = tx and luci.tools.webadmin.byte_format(tonumber(tx)) or "-"

	return string.format("%s / %s", tx, rx)
end

errors = s:option(DummyValue, "_err",
 translate("network_interface_err"), translate("network_interface_err_desc"))

function errors.cfgvalue(self, section)
	local ix = self.map:get(section, "ifname")

	local rx = netstat and netstat[ix] and netstat[ix][3]
	local tx = netstat and netstat[ix] and netstat[ix][11]

	rx = rx and tostring(rx) or "-"
	tx = tx and tostring(tx) or "-"

	return string.format("%s / %s", tx, rx)
end



s = m:section(NamedSection, "lan", "interface", translate("m_n_local"))
s.addremove = false
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
s.addremove = false
p = s:option(ListValue, "proto", translate("protocol"))
p.override_values = true
p:value("none", "disabled")
p:value("static", translate("manual", "manual"))
p:value("dhcp", translate("automatic", "automatic"))
if has_pppoe then p:value("pppoe", "PPPoE") end
if has_pptp  then p:value("pptp",  "PPTP")  end

function p.write(self, section, value)
	-- Always set defaultroute to PPP and use remote dns
	-- Overwrite a bad variable behaviour in OpenWrt
	if value == "pptp" or value == "pppoe" then
		self.map:set(section, "peerdns", "1")
		self.map:set(section, "defaultroute", "1")
	end
	return ListValue.write(self, section, value)
end

if not ( has_pppoe and has_pptp ) then
	p.description = translate("network_interface_prereq_mini")
end


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
pwd.password = true
pwd:depends("proto", "pppoe")
pwd:depends("proto", "pptp")


-- Allow user to set MSS correction here if the UCI firewall is installed
-- This cures some cancer for providers with pre-war routers
if luci.fs.access("/etc/config/firewall") then
	mssfix = s:option(Flag, "_mssfix",
		translate("m_n_mssfix"), translate("m_n_mssfix_desc"))
	mssfix.rmempty = false

	function mssfix.cfgvalue(self)
		local value
		m.uci:foreach("firewall", "forwarding", function(s)
			if s.src == "lan" and s.dest == "wan" then
				value = s.mtu_fix
			end
		end)
		return value
	end

	function mssfix.write(self, section, value)
		m.uci:foreach("firewall", "forwarding", function(s)
			if s.src == "lan" and s.dest == "wan" then
				m.uci:set("firewall", s[".name"], "mtu_fix", value)
				m:chain("firewall")
			end
		end)
	end
end

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



return m
