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
m = Map("luci_hosts", translate("Hostnames"))

s = m:section(TypedSection, "host", translate("Host entries"))
s.addremove = true
s.anonymous = true
s.template = "cbi/tblsection"

hn = s:option(Value, "hostname", translate("Hostname"))
ip = s:option(Value, "ipaddr", translate("IP address"))
for i, dataset in ipairs(luci.sys.net.arptable()) do
	ip:value(
		dataset["IP address"],
		"%s (%s)" %{ dataset["IP address"], dataset["HW address"] }
	)
end

return m
