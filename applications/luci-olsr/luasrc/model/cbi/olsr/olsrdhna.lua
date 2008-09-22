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

for i, sect in ipairs({ "Hna4", "Hna6" }) do
	hna = mh:section(TypedSection, sect)
	hna.addremove = true
	hna.anonymous = true
	hna.template  = "cbi/tblsection"

	net = hna:option(Value, "netaddr")
	msk = hna:option(Value, "netmask")
end

return mh
