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

m = Map("freifunk", translate("Contact"), translate("Please fill in your contact details below."))

c = m:section(NamedSection, "contact", "public", "")

local nick = c:option(Value, "nickname", translate("Nickname"))
nick.rmempty = false

name = c:option(Value, "name", translate("Realname"))
name.rmempty = false

mail = c:option(Value, "mail", translate("E-Mail"))
mail.rmempty = false

c:option(Value, "phone", translate("Phone"))

c:option(Value, "note", translate("Notice"))

return m
