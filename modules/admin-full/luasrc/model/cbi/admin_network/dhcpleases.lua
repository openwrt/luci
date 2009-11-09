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
local sys = require "luci.sys"
local wa  = require "luci.tools.webadmin"
local fs  = require "nixio.fs"

m2 = Map("dhcp", translate("DHCP Leases"),
	translate("Static leases are used to assign fixed IP addresses and symbolic hostnames to " ..
		"DHCP clients. They are also required for non-dynamic interface configurations where " ..
		"only hosts with a corresponding lease are served."))

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
	v = m2:section(Table, leases, translate("Active Leases"))
	ip = v:option(DummyValue, 3, translate("<abbr title=\"Internet Protocol Version 4\">IPv4</abbr>-Address"))
	
	mac  = v:option(DummyValue, 2, translate("<abbr title=\"Media Access Control\">MAC</abbr>-Address"))
	
	ltime = v:option(DummyValue, 1, translate("Leasetime remaining"))
	function ltime.cfgvalue(self, ...)
		local value = DummyValue.cfgvalue(self, ...)
		return wa.date_format(os.difftime(tonumber(value), os.time()))
	end
end

s = m2:section(TypedSection, "host", translate("Static Leases"),
	translate("Use the <em>Add</em> Button to add a new lease entry. The <em>MAC-Address</em> " ..
		"indentifies the host, the <em>IPv4-Address</em> specifies to the fixed address to " ..
		"use and the <em>Hostname</em> is assigned as symbolic name to the requesting host."))

s.addremove = true
s.anonymous = true
s.template = "cbi/tblsection"

name = s:option(Value, "name", translate("Hostname"))
mac = s:option(Value, "mac", translate("<abbr title=\"Media Access Control\">MAC</abbr>-Address"))
ip = s:option(Value, "ip", translate("<abbr title=\"Internet Protocol Version 4\">IPv4</abbr>-Address"))
sys.net.arptable(function(entry)
	ip:value(entry["IP address"])
	mac:value(
		entry["HW address"],
		entry["HW address"] .. " (" .. entry["IP address"] .. ")"
	)
end)

	
return m2
