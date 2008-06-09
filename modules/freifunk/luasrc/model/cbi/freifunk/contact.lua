--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--
m = Map("freifunk", translate("contact"), translate("contact1"))

c = m:section(NamedSection, "contact", "public", "")

c:option(Value, "nickname", translate("nickname"))
c:option(Value, "name", translate("name"))
c:option(Value, "mail", translate("mail"), translate("mail1"))
c:option(Value, "phone", translate("phone"))
c:option(Value, "location", translate("location"))
c:option(Value, "geo", translate("coord"), translate("coord1"))
c:option(Value, "note", translate("note"))

return m