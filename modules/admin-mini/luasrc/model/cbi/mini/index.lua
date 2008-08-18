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
require("luci.tools.webadmin")

w = Template("mini/index")

f = SimpleForm("main", translate("system"))
f.reset = false
f.submit = false

local system, model, memtotal, memcached, membuffers, memfree = luci.sys.sysinfo()
local uptime = luci.sys.uptime()
f:field(DummyValue, "_system", translate("system")).value = system
f:field(DummyValue, "_cpu", translate("m_i_processor")).value = model

local load1, load5, load15 = luci.sys.loadavg()
f:field(DummyValue, "_la", translate("load")).value = 
 string.format("%.2f, %.2f, %.2f", load1, load5, load15)
 
f:field(DummyValue, "_memtotal", translate("m_i_memory")).value = 
 string.format("%.2f MB (%.0f%% %s, %.0f%% %s, %.0f%% %s)",
  tonumber(memtotal) / 1024,
  100 * memcached / memtotal,
  translate("mem_cached") or "",
  100 * membuffers / memtotal,
  translate("mem_buffered") or "",
  100 * memfree / memtotal,
  translate("mem_free") or "")

f:field(DummyValue, "_systime", translate("m_i_systemtime")).value =
 os.date("%c")
 
f:field(DummyValue, "_uptime", translate("m_i_uptime")).value = 
 luci.tools.webadmin.date_format(tonumber(uptime))
 
 
m = Map("network", translate("interfaces"))
m.stateful = true
local netstat = luci.sys.net.deviceinfo()

m.parse = function() end

s = m:section(TypedSection, "interface", "")
s.template  = "cbi/tblsection"

function s.filter(self, section)
	return section ~= "loopback" and section
end

hwaddr = s:option(DummyValue, "_hwaddr")
function hwaddr.cfgvalue(self, section)
	local ix = self.map:get(section, "ifname") or ""
	return luci.fs.readfile("/sys/class/net/" .. ix .. "/address") or "n/a"
end


s:option(DummyValue, "ipaddr", translate("ipaddress"))

s:option(DummyValue, "netmask", translate("netmask"))


txrx = s:option(DummyValue, "_txrx")

function txrx.cfgvalue(self, section)
	local ix = self.map:get(section, "ifname")
	
	local rx = netstat and netstat[ix] and netstat[ix][1]
	rx = rx and luci.tools.webadmin.byte_format(tonumber(rx)) or "-"
	
	local tx = netstat and netstat[ix] and netstat[ix][9]
	tx = tx and luci.tools.webadmin.byte_format(tonumber(tx)) or "-"
	
	return string.format("%s / %s", tx, rx)
end

errors = s:option(DummyValue, "_err")

function errors.cfgvalue(self, section)
	local ix = self.map:get(section, "ifname")
	
	local rx = netstat and netstat[ix] and netstat[ix][3]
	local tx = netstat and netstat[ix] and netstat[ix][11]
	
	rx = rx and tostring(rx) or "-"
	tx = tx and tostring(tx) or "-"
	
	return string.format("%s / %s", tx, rx)
end

return w, f, m