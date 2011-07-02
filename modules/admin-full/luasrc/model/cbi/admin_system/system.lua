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

local system, model, memtotal, memcached, membuffers, memfree = luci.sys.sysinfo()
local uptime = luci.sys.uptime()

s:taboption("general", DummyValue, "_system", translate("System")).value = system
s:taboption("general", DummyValue, "_cpu", translate("Processor")).value = model

s:taboption("general", DummyValue, "_kernel", translate("Kernel")).value =
 luci.util.exec("uname -r") or "?"

local load1, load5, load15 = luci.sys.loadavg()
s:taboption("general", DummyValue, "_la", translate("Load")).value =
 string.format("%.2f, %.2f, %.2f", load1, load5, load15)

s:taboption("general", DummyValue, "_memtotal", translate("Memory")).value =
 string.format("%.2f MB (%.0f%% %s, %.0f%% %s, %.0f%% %s)",
  tonumber(memtotal) / 1024,
  100 * memcached / memtotal,
  tostring(translate("cached")),
  100 * membuffers / memtotal,
  tostring(translate("buffered")),
  100 * memfree / memtotal,
  tostring(translate("free"))
)

s:taboption("general", DummyValue, "_systime", translate("Local Time")).value =
 os.date("%c")

s:taboption("general", DummyValue, "_uptime", translate("Uptime")).value =
 luci.tools.webadmin.date_format(tonumber(uptime))

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
	m3= Map("timeserver", translate("Time Server (rdate)"))
	s = m3:section(TypedSection, "timeserver")
	s.anonymous = true
	s.addremove = true
	s.template = "cbi/tblsection"

	h = s:option(Value, "hostname", translate("Name"))
	h.rmempty = true
	h.datatype = host
	i = s:option(ListValue, "interface", translate("Interface"))
	i.rmempty = true
	i:value("", translate("Default"))
	m3.uci:foreach("network", "interface",
		function (section)
			local ifc = section[".name"]
			if ifc ~= "loopback" then
				i:value(ifc)
			end
		end
	)
end


m2 = Map("luci")

f = m2:section(NamedSection, "main", "core", translate("Files to be kept when flashing a new firmware"))

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

	return "<em>" .. translate("No files found") .. "</em>"
end

c = f:taboption("custom", TextValue, "_custom", translate("Custom files"))
c.rmempty = false
c.cols = 70
c.rows = 30

c.cfgvalue = function(self, section)
	return nixio.fs.readfile("/etc/sysupgrade.conf")
end

c.write = function(self, section, value)
	value = value:gsub("\r\n?", "\n")
	return nixio.fs.writefile("/etc/sysupgrade.conf", value)
end


return m, m3 or m2, m3 and m2
