--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--

local uci = require "luci.model.uci".cursor()
local wa  = require "luci.tools.webadmin"
local sys = require "luci.sys"
local utl = require "luci.util"
local fs  = require "nixio.fs"

m = Map("dhcp", "DHCP")

s = m:section(TypedSection, "dhcp", "")
s.addremove = true
s.anonymous = true

iface = s:option(ListValue, "interface", translate("interface"))
wa.cbi_add_networks(iface)

uci:foreach("network", "interface",
	function (section)
		if section[".name"] ~= "loopback" then
			iface.default = iface.default or section[".name"]
			s:depends("interface", section[".name"])
		end
	end)

uci:foreach("network", "alias",
	function (section)
		iface:value(section[".name"])
		s:depends("interface", section[".name"])
	end)

s:option(Value, "start", translate("start")).rmempty = true

s:option(Value, "limit", translate("limit")).rmempty = true

s:option(Value, "leasetime").rmempty = true

local dd = s:option(Flag, "dynamicdhcp")
dd.rmempty = false
function dd.cfgvalue(self, section)
	return Flag.cfgvalue(self, section) or "1"
end

s:option(Value, "name", translate("name")).optional = true

ignore = s:option(Flag, "ignore")
ignore.optional = true

s:option(Value, "netmask", translate("netmask")).optional = true

s:option(Flag, "force").optional = true

s:option(DynamicList, "dhcp_option").optional = true


for i, n in ipairs(s.children) do
	if n ~= iface and n ~= ignore then
		n:depends("ignore", "")
	end
end


m2 = Map("dhcp", translate("dhcp_leases"), "")

local leasefn, leasefp, leases
uci:foreach("dhcp", "dnsmasq",
 function(section)
 	leasefn = section.leasefile
 end
) 
local leasefp = leasefn and fs.access(leasefn) and io.lines(leasefn)
if leasefp then
	leases = {}
	for lease in leasefp do
		table.insert(leases, luci.util.split(lease, " "))
	end
end

if leases then
	v = m2:section(Table, leases, translate("dhcp_leases_active"))

	name = v:option(DummyValue, 4, translate("hostname"))
	function name.cfgvalue(self, ...)
		local value = DummyValue.cfgvalue(self, ...)
		return (value == "*") and "?" or value
	end

	ip = v:option(DummyValue, 3, translate("ipaddress"))
	
	mac  = v:option(DummyValue, 2, translate("macaddress"))
	
	ltime = v:option(DummyValue, 1, translate("dhcp_timeremain"))
	function ltime.cfgvalue(self, ...)
		local value = DummyValue.cfgvalue(self, ...)
		return wa.date_format(os.difftime(tonumber(value), os.time()))
	end
end

s = m2:section(TypedSection, "host", translate("luci_ethers"))
s.addremove = true
s.anonymous = true
s.template = "cbi/tblsection"

name = s:option(Value, "name", translate("hostname"))
mac = s:option(Value, "mac", translate("macaddress"))
ip = s:option(Value, "ip", translate("ipaddress"))
sys.net.arptable(function(entry)
	ip:value(entry["IP address"])
	mac:value(
		entry["HW address"],
		entry["HW address"] .. " (" .. entry["IP address"] .. ")"
	)
end)

	
return m, m2

