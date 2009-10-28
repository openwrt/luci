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

m2 = Map("dhcp", "Address Assignment")

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
	ip = v:option(DummyValue, 3, translate("ipaddress"))
	
	mac  = v:option(DummyValue, 2, translate("macaddress"))
	
	ltime = v:option(DummyValue, 1, translate("dhcp_timeremain"))
	function ltime.cfgvalue(self, ...)
		local value = DummyValue.cfgvalue(self, ...)
		return wa.date_format(os.difftime(tonumber(value), os.time()))
	end
end

s = m2:section(TypedSection, "host")
s.addremove = true
s.anonymous = true
s.template = "cbi/tblsection"

hn = s:option(Value, "name", translate("hostnames_hostname"))
mac = s:option(Value, "mac", translate("macaddress"))
ip = s:option(Value, "ip", translate("ipaddress"))
sys.net.arptable(function(entry)
	ip:value(entry["IP address"])
	mac:value(
		entry["HW address"],
		entry["HW address"] .. " (" .. entry["IP address"] .. ")"
	)
end)

	
return m2
