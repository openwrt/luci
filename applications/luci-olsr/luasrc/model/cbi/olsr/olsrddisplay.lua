--[[
LuCI - Lua Configuration Interface

Copyright 2011 Manuel Munz <freifunk at somakoma de>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0
]]--

m = Map("luci_olsr", translate("OLSR - Display Options"))

s = m:section(TypedSection, "olsr")
s.anonymous = true

res = s:option(Flag, "resolve", translate("Resolve"),
        translate("Resolve hostnames on status pages. It is generally safe to allow this, but if you use public IPs and have unstable DNS-Setup then those pages will load really slow. In this case disable it here."))
res.default = "0"
res.optional = true

return m
