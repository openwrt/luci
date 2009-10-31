--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--

local fs = require "nixio.fs"
local i18n = require "luci.i18n"
local util = require "luci.util"
local config = require "luci.config"

m = Map("system", translate("System"))

s = m:section(TypedSection, "system", "")
s.anonymous = true
s.addremove = false

hn = s:option(Value, "hostname", translate("Hostname"))



m2 = Map("luci", translate("Web <abbr title=\"User Interface\">UI</abbr>"))


c = m2:section(NamedSection, "main", "core")

l = c:option(ListValue, "lang", translate("Language"))
l:value("auto")

local i18ndir = i18n.i18ndir .. "default."
for k, v in util.kspairs(config.languages) do
	local file = i18ndir .. k:gsub("_", "-")
	if k:sub(1, 1) ~= "." and fs.access(file .. ".lmo") then
		l:value(k, v)
	end
end
return m, m2
