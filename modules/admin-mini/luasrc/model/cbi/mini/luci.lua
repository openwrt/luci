--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>
Copyright 2008 Jo-Philipp Wich <xm@leipzig.freifunk.net>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--

require "luci.config"
local fs = require "nixio.fs"

m = Map("luci", translate("Web <abbr title=\"User Interface\">UI</abbr>"), translate("Here you can customize the settings and the functionality of <abbr title=\"Lua Configuration Interface\">LuCI</abbr>."))

-- force reload of global luci config namespace to reflect the changes
function m.commit_handler(self)
	package.loaded["luci.config"] = nil
	require "luci.config"
end


c = m:section(NamedSection, "main", "core", translate("General"))

l = c:option(ListValue, "lang", translate("Language"))
l:value("auto")

local i18ndir = luci.i18n.i18ndir .. "base."
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

return m
