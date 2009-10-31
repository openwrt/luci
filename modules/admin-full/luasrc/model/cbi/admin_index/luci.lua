--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--
require("luci.config")
m = Map("luci", translate("Web <abbr title=\"User Interface\">UI</abbr>"), translate("Here you can customize the settings and the functionality of <abbr title=\"Lua Configuration Interface\">LuCI</abbr>."))

local fs = require "nixio.fs"

-- force reload of global luci config namespace to reflect the changes
function m.commit_handler(self)
	package.loaded["luci.config"] = nil
	require("luci.config")
end


c = m:section(NamedSection, "main", "core", translate("General"))

l = c:option(ListValue, "lang", translate("Language"))
l:value("auto")

local i18ndir = luci.i18n.i18ndir .. "default."
for k, v in luci.util.kspairs(luci.config.languages) do
	local file = i18ndir .. k:gsub("_", "-")
	if k:sub(1, 1) ~= "." and fs.access(file .. ".lmo") then
		l:value(k, v)
	end
end

t = c:option(ListValue, "mediaurlbase", translate("Design"))
for k, v in pairs(luci.config.themes) do
	if k:sub(1, 1) ~= "." then
		t:value(v, k)
	end
end

u = m:section(NamedSection, "uci_oncommit", "event", translate("Post-commit actions"),
 translate("These commands will be executed automatically when a given <abbr title=\"Unified Configuration Interface\">UCI</abbr> configuration is committed allowing changes to be applied instantly."))
u.dynamic = true

f = m:section(NamedSection, "flash_keep", "extern", translate("Files to be kept when flashing a new firmware"),
 translate("When flashing a new firmware with <abbr title=\"Lua Configuration Interface\">LuCI</abbr> these files will be added to the new firmware installation."))
f.dynamic = true

return m
