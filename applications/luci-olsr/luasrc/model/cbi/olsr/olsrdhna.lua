--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--

mh = Map("olsrd", translate("olsrd_hna", "OLSR - HNA-Ankündigungen"))


hna4 = mh:section(TypedSection, "Hna4")
hna4.addremove = true
hna4.anonymous = true
hna4.template  = "cbi/tblsection"

net4 = hna4:option(Value, "netaddr")
msk4 = hna4:option(Value, "netmask")


hna6 = mh:section(TypedSection, "Hna6")
hna6.addremove = true
hna6.anonymous = true
hna6.template  = "cbi/tblsection"

net6 = hna6:option(Value, "netaddr")
msk6 = hna6:option(Value, "prefix")


return mh
