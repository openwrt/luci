--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--

luci.i18n.loadc("freifunk")

m = Map("freifunk", translate("contact"), translate("contact1"))

c = m:section(NamedSection, "contact", "public", "")

c:option(Value, "nickname", translate("Nickname"))
c:option(Value, "name", translate("Realname"))
c:option(Value, "mail", translate("E-Mail"), translate("You really should provide your address here!"))
c:option(Value, "phone", translate("Phone"))
c:option(Value, "location", translate("Location"))
c:option(Value, "note", translate("Notice"))

m2 = Map("system", translate("geo"))

s = m2:section(TypedSection, "system", "")
s:option(Value, "latitude", translate("Breite")).rmempty = true
s:option(Value, "longitude", translate("Länge")).rmempty = true

return m, m2
