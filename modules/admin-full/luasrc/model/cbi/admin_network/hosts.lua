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
require("luci.util")
m = Map("dhcp", translate("hostnames"))

s = m:section(TypedSection, "domain", translate("hostnames_entries"))
s.addremove = true
s.anonymous = true
s.template = "cbi/tblsection"

hn = s:option(Value, "name", translate("hostnames_hostname"))
ip = s:option(Value, "ip", translate("hostnames_address"))
for i, dataset in ipairs(luci.sys.net.arptable()) do
	ip:value(
		dataset["IP address"],
		"%s (%s)" %{ dataset["IP address"], dataset["HW address"] }
	)
end

return m
