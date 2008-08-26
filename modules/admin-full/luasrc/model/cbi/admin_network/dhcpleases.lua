--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--
require("luci.sys")
require("luci.tools.webadmin")
m2 = Map("luci_ethers", translate("dhcp_leases"))

local leasefn, leasefp, leases
luci.model.uci.cursor():foreach("dhcp", "dnsmasq",
 function(section)
 	leasefn = section.leasefile
 end
) 
local leasefp = leasefn and luci.fs.access(leasefn) and io.lines(leasefn)
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
		return luci.tools.webadmin.date_format(
		 os.difftime(tonumber(value), os.time())
		)
	end
end

s = m2:section(TypedSection, "static_lease", translate("luci_ethers"))
s.addremove = true
s.anonymous = true
s.template = "cbi/tblsection"

mac = s:option(Value, "macaddr", translate("macaddress"))
ip = s:option(Value, "ipaddr", translate("ipaddress"))
for i, dataset in ipairs(luci.sys.net.arptable()) do
	ip:value(dataset["IP address"])
	mac:value(dataset["HW address"],
	 dataset["HW address"] .. " (" .. dataset["IP address"] .. ")")
end

	
return m2
