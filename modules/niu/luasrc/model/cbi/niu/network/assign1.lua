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
local fs  = require "nixio.fs"


local function date_format(secs)
	local suff = {"min", "h", "d"}
	local mins = 0
	local hour = 0
	local days = 0
	
	secs = math.floor(secs)
	if secs > 60 then
		mins = math.floor(secs / 60)
		secs = secs % 60
	end
	
	if mins > 60 then
		hour = math.floor(mins / 60)
		mins = mins % 60
	end
	
	if hour > 24 then
		days = math.floor(hour / 24)
		hour = hour % 24
	end
	
	if days > 0 then
		return string.format("%.0fd %02.0fh %02.0fmin %02.0fs", days, hour, mins, secs)
	else
		return string.format("%02.0fh %02.0fmin %02.0fs", hour, mins, secs)
	end
end

m2 = Map("dhcp", "Manage Address Assignment")

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
		return date_format(os.difftime(tonumber(value), os.time()))
	end
end

s = m2:section(TypedSection, "host", "Static Assignment",
"You can assign fixed addresses and DNS names to devices in you local network to make reaching them more easy.")
s.addremove = true
s.anonymous = true
s.template = "cbi/tblsection"

hn = s:option(Value, "name", translate("Hostname"))
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
