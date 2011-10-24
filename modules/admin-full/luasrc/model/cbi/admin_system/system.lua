--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>
Copyright 2011 Jo-Philipp Wich <xm@subsignal.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--

require("luci.sys")
require("luci.sys.zoneinfo")
require("luci.tools.webadmin")
require("luci.fs")
require("luci.config")

m = Map("system", translate("System"), translate("Here you can configure the basic aspects of your device like its hostname or the timezone."))
m:chain("luci")

local has_rdate = false

m.uci:foreach("system", "rdate",
	function()
		has_rdate = true
		return false
	end)


s = m:section(TypedSection, "system", translate("System Properties"))
s.anonymous = true
s.addremove = false

s:tab("general",  translate("General Settings"))
s:tab("logging",  translate("Logging"))
s:tab("language", translate("Language and Style"))


--
-- System Properties
--

clock = s:taboption("general", DummyValue, "_systime", translate("Local Time"))
clock.template = "admin_system/clock_status"


hn = s:taboption("general", Value, "hostname", translate("Hostname"))
hn.datatype = "hostname"

function hn.write(self, section, value)
	Value.write(self, section, value)
	luci.sys.hostname(value)
end


tz = s:taboption("general", ListValue, "zonename", translate("Timezone"))
tz:value("UTC")

for i, zone in ipairs(luci.sys.zoneinfo.TZ) do
	tz:value(zone[1])
end

function tz.write(self, section, value)
	local function lookup_zone(title)
		for _, zone in ipairs(luci.sys.zoneinfo.TZ) do
			if zone[1] == title then return zone[2] end
		end
	end

	AbstractValue.write(self, section, value)
	local timezone = lookup_zone(value) or "GMT0"
	self.map.uci:set("system", section, "timezone", timezone)
	luci.fs.writefile("/etc/TZ", timezone .. "\n")
end


--
-- Logging
--

o = s:taboption("logging", Value, "log_size", translate("System log buffer size"), "kiB")
o.optional    = true
o.placeholder = 16
o.datatype    = "uinteger"

o = s:taboption("logging", Value, "log_ip", translate("External system log server"))
o.optional    = true
o.placeholder = "0.0.0.0"
o.datatype    = "ip4addr"

o = s:taboption("logging", Value, "log_port", translate("External system log server port"))
o.optional    = true
o.placeholder = 514
o.datatype    = "port"

o = s:taboption("logging", ListValue, "conloglevel", translate("Log output level"))
o:value(8, translate("Debug"))
o:value(7, translate("Info"))
o:value(6, translate("Notice"))
o:value(5, translate("Warning"))
o:value(4, translate("Error"))
o:value(3, translate("Critical"))
o:value(2, translate("Alert"))
o:value(1, translate("Emergency"))

o = s:taboption("logging", ListValue, "cronloglevel", translate("Cron Log Level"))
o.default = 8
o:value(5, translate("Debug"))
o:value(8, translate("Normal"))
o:value(9, translate("Warning"))


--
-- Langauge & Style
--

o = s:taboption("language", ListValue, "_lang", translate("Language"))
o:value("auto")

local i18ndir = luci.i18n.i18ndir .. "base."
for k, v in luci.util.kspairs(luci.config.languages) do
	local file = i18ndir .. k:gsub("_", "-")
	if k:sub(1, 1) ~= "." and luci.fs.access(file .. ".lmo") then
		o:value(k, v)
	end
end

function o.cfgvalue(...)
	return m.uci:get("luci", "main", "lang")
end

function o.write(self, section, value)
	m.uci:set("luci", "main", "lang", value)
end


o = s:taboption("language", ListValue, "_mediaurlbase", translate("Design"))
for k, v in pairs(luci.config.themes) do
	if k:sub(1, 1) ~= "." then
		o:value(v, k)
	end
end

function o.cfgvalue(...)
	return m.uci:get("luci", "main", "mediaurlbase")
end

function o.write(self, section, value)
	m.uci:set("luci", "main", "mediaurlbase", value)
end


--
-- Rdate
--

if has_rdate then
	m2 = Map("timeserver", translate("Time Server (rdate)"))
	s = m2:section(TypedSection, "timeserver")
	s.anonymous = true
	s.addremove = true
	s.template = "cbi/tblsection"

	h = s:option(Value, "hostname", translate("Name"))
	h.rmempty = true
	h.datatype = host
	i = s:option(ListValue, "interface", translate("Interface"))
	i.rmempty = true
	i:value("", translate("Default"))
	m2.uci:foreach("network", "interface",
		function (section)
			local ifc = section[".name"]
			if ifc ~= "loopback" then
				i:value(ifc)
			end
		end
	)
end


return m, m2
