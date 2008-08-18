--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--
require("luci.http.protocol.date")
require("luci.sys")
require("luci.tools.webadmin")


m = Map("system", translate("system"), translate("a_s_desc"))

s = m:section(TypedSection, "system", "")
s.anonymous = true



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
  translate("mem_cached") or "",
  100 * membuffers / memtotal,
  translate("mem_buffered") or "",
  100 * memfree / memtotal,
  translate("mem_free") or "")

s:option(DummyValue, "_systime", translate("m_i_systemtime")).value =
 os.date("%c")
 
s:option(DummyValue, "_uptime", translate("m_i_uptime")).value = 
 luci.tools.webadmin.date_format(tonumber(uptime))
 
 
 
 

s:option(Value, "hostname", translate("hostname"))

tz = s:option(ListValue, "timezone", translate("timezone"))
for k, offset in luci.util.vspairs(luci.http.protocol.date.TZ) do
	local zone = k:upper()	
	local osgn = (offset >= 0 and "" or "+")
	local ohrs = math.floor(-offset / 3600)
	local omin = (offset % 3600) / 60
	
	local ptz = zone .. osgn .. (ohrs ~= 0 and ohrs or "") .. (omin ~= 0 and ":" .. omin or "")
	local dtz = string.format("%+03d:%02d ", ohrs, omin) .. zone
	
	tz:value(ptz, dtz)
end

return m
