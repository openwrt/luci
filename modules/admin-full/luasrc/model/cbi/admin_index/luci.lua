--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>
Copyright 2010 Jo-Philipp Wich <xm@subsignal.org>

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

u = m:section(NamedSection, "uci_oncommit", "event", translate("Post-commit actions"),
 translate("These commands will be executed automatically when a given <abbr title=\"Unified Configuration Interface\">UCI</abbr> configuration is committed allowing changes to be applied instantly."))
u.dynamic = true


f = m:section(NamedSection, "main", "core", translate("Files to be kept when flashing a new firmware"))

f:tab("detected", translate("Detected Files"),
	translate("The following files are detected by the system and will be kept automatically during sysupgrade"))

f:tab("custom", translate("Custom Files"),
	translate("This is a list of shell glob patterns for matching files and directories to include during sysupgrade"))

d = f:taboption("detected", DummyValue, "_detected", translate("Detected files"))
d.rawhtml = true
d.cfgvalue = function(s)
	local list = io.popen(
		"( find $(sed -ne '/^[[:space:]]*$/d; /^#/d; p' /etc/sysupgrade.conf " ..
		"/lib/upgrade/keep.d/* 2>/dev/null) -type f 2>/dev/null; " ..
		"opkg list-changed-conffiles ) | sort -u"
	)

	if list then
		local files = { "<ul>" }

		while true do
			local ln = list:read("*l")
			if not ln then
				break
			else
				files[#files+1] = "<li>"
				files[#files+1] = luci.util.pcdata(ln)
				files[#files+1] = "</li>"
			end
		end

		list:close()
		files[#files+1] = "</ul>"

		return table.concat(files, "")
	end

	return "<em>No files found</em>"
end

c = f:taboption("custom", TextValue, "_custom", translate("Custom files"))
c.rmempty = false
c.cols = 70
c.rows = 30

c.cfgvalue = function(self, section)
	return nixio.fs.readfile("/etc/sysupgrade.conf")
end

c.write = function(self, section, value)
	return nixio.fs.writefile("/etc/sysupgrade.conf", value)
end

return m
