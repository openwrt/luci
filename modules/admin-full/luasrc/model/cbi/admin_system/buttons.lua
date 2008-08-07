--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--
m = Map("system", translate("buttons"), translate("buttons_desc"))

s = m:section(TypedSection, "button", "")
s.anonymous = true
s.addremove = true

s:option(Value, "button")

act = s:option(ListValue, "action")
act:value("released")

s:option(Value, "handler")

min = s:option(Value, "min")
min.rmempty = true

max = s:option(Value, "max")
max.rmempty = true
