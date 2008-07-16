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
require("luci.model.uci")
require("luci.sys")

m = Map("dhcp", "DHCP")

s = m:section(TypedSection, "dhcp", "DHCP-Server")
s.anonymous = true
s:depends("interface", "lan")

enable = s:option(ListValue, "ignore", "", "")
enable:value(0, "enabled")
enable:value(1, "disabled")

start = s:option(Value, "start", "First address")
start.rmempty = true
start:depends("ignore", "0")


limit = s:option(Value, "limit", "Number of leases", "")
limit:depends("ignore", "0")

function limit.cfgvalue(self, section)
	local value = Value.cfgvalue(self, section)
	
	if value then
		return tonumber(value) + 1
	end 
end

function limit.write(self, section, value)
	value = tonumber(value) - 1
	return Value.write(self, section, value) 
end

limit.rmempty = true

time = s:option(Value, "leasetime")
time:depends("ignore", "0")
time.rmempty = true

m2 = Map("luci_ethers", translate("luci_ethers"))

s = m2:section(TypedSection, "static_lease", "")
s.addremove = true
s.anonymous = true
s.template = "cbi/tblsection"

s:option(Value, "macaddr", translate("macaddress"))
s:option(Value, "ipaddr", translate("ipaddress"))

return m, m2