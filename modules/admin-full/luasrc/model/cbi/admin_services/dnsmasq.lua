--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--
m = Map("dhcp", "Dnsmasq")

s = m:section(TypedSection, "dnsmasq", translate("settings"))
s.anonymous = true

s:option(Flag, "domainneeded")
s:option(Flag, "authoritative")
s:option(Flag, "boguspriv")
s:option(Flag, "filterwin2k")
s:option(Flag, "localise_queries")
s:option(Value, "local")
s:option(Value, "domain")
s:option(Flag, "expandhosts")
s:option(Flag, "nonegcache")
s:option(Flag, "readethers")
s:option(Value, "leasefile")
s:option(Value, "resolvfile")
s:option(Flag, "nohosts").optional = true
s:option(Flag, "strictorder").optional = true
s:option(Flag, "logqueries").optional = true
s:option(Flag, "noresolv").optional = true
s:option(Value, "dnsforwardmax").optional = true
s:option(Value, "port").optional = true
s:option(Value, "ednspacket_max").optional = true
s:option(Value, "dhcpleasemax").optional = true
s:option(Value, "addnhosts").optional = true
s:option(Value, "queryport").optional = true

return m