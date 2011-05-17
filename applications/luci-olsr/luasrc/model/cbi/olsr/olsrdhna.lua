--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--

mh = Map("olsrd", translate("OLSR - HNA-Announcements"))


hna4 = mh:section(TypedSection, "Hna4", translate("Hna4"), translate("Both values must use the dotted decimal notation."))
hna4.addremove = true
hna4.anonymous = true
hna4.template  = "cbi/tblsection"

net4 = hna4:option(Value, "netaddr", translate("Network address"))
net4.datatype = "ip4addr"
net4.placeholder = "15.15.0.0"
msk4 = hna4:option(Value, "netmask", translate("Netmask"))
msk4.datatype = "ip4addr"
msk4.placeholder = "255.255.255.0"

hna6 = mh:section(TypedSection, "Hna6", translate("Hna6"), translate("IPv6 network must be given in full notation, " ..
	"prefix must be in CIDR notation."))
hna6.addremove = true
hna6.anonymous = true
hna6.template  = "cbi/tblsection"

net6 = hna6:option(Value, "netaddr", translate("Network address"))
net6.datatype = "ip6addr"
net6.placeholder = "fec0:2200:106:0:0:0:0:0"
msk6 = hna6:option(Value, "prefix", translate("Prefix"))
msk6.datatype = "integer"
msk6.placeholder = "48"


return mh
