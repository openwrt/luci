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
m = Map("luci", translate("webui"), translate("a_i_luci1",
 "Hier können Eigenschaften und die Funktionalität der Oberfläche angepasst werden."))

local fs = require "nixio.fs"

-- force reload of global luci config namespace to reflect the changes
function m.commit_handler(self)
	package.loaded["luci.config"] = nil
	require("luci.config")
end


c = m:section(NamedSection, "main", "core", translate("general"))

l = c:option(ListValue, "lang", translate("language"))
l:value("auto")

local i18ndir = luci.i18n.i18ndir .. "default."
for k, v in luci.util.kspairs(luci.config.languages) do
	local file = i18ndir .. k:gsub("_", "-")
	if k:sub(1, 1) ~= "." and fs.access(file .. ".lmo") then
		l:value(k, v)
	end
end

t = c:option(ListValue, "mediaurlbase", translate("design"))
for k, v in pairs(luci.config.themes) do
	if k:sub(1, 1) ~= "." then
		t:value(v, k)
	end
end

u = m:section(NamedSection, "uci_oncommit", "event", translate("a_i_ucicommit"),
 translate("a_i_ucicommit1"))
u.dynamic = true

f = m:section(NamedSection, "flash_keep", "extern", translate("a_i_keepflash"),
 translate("a_i_keepflash1"))
f.dynamic = true

return m
