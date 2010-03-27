--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>

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

m = Map("system", translate("system"), translate("a_s_desc"))

function m.on_parse()
	local has_rdate = false

	m.uci:foreach("system", "rdate",
		function()
			has_rdate = true
			return false
		end)

	if not has_rdate then
		m.uci:section("system", "rdate", nil, { })
		m.uci:save("system")
	end
end


s = m:section(TypedSection, "system", "")
s.anonymous = true
s.addremove = false

local system, model, memtotal, memcached, membuffers, memfree = luci.sys.sysinfo()
local uptime = luci.sys.uptime()

s:option(DummyValue, "_system", translate("system")).value = system
s:option(DummyValue, "_cpu", translate("m_i_processor")).value = model

local load1, load5, load15 = luci.sys.loadavg()
s:option(DummyValue, "_la", translate("load")).value =
 string.format("%.2f, %.2f, %.2f", load1, load5, load15)

s:option(DummyValue, "_memtotal", translate("m_i_memory")).value =
 string.format("%.2f MB (%.0f%% %s, %.0f%% %s, %.0f%% %s)",
  tonumber(memtotal) / 1024,
  100 * memcached / memtotal,
  tostring(translate("mem_cached", "")),
  100 * membuffers / memtotal,
  tostring(translate("mem_buffered", "")),
  100 * memfree / memtotal,
  tostring(translate("mem_free", ""))
)

s:option(DummyValue, "_systime", translate("m_i_systemtime")).value =
 os.date("%c")

s:option(DummyValue, "_uptime", translate("m_i_uptime")).value =
 luci.tools.webadmin.date_format(tonumber(uptime))

hn = s:option(Value, "hostname", translate("hostname"))

function hn.write(self, section, value)
	Value.write(self, section, value)
	luci.sys.hostname(value)
end


tz = s:option(ListValue, "zonename", translate("timezone"))
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

s:option(Value, "log_size", nil, "kiB").optional = true
s:option(Value, "log_ip").optional = true
s:option(Value, "conloglevel").optional = true
s:option(Value, "cronloglevel").optional = true

s2 = m:section(TypedSection, "rdate", translate("timesrv", "Time Server (rdate)"))
s2.anonymous = true
s2.addremove = false

s2:option(DynamicList, "server", translate("server", "Server"))

return m
