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
require("luci.sys")


m = Map("network", translate("interfaces"), translate("a_n_ifaces1"))

local created
local netstat = luci.sys.net.deviceinfo()

s = m:section(TypedSection, "interface", translate("interfaces"))
s.addremove = true
s.extedit   = luci.http.getenv("REQUEST_URI") .. "/%s"
s.template  = "cbi/tblsection"

function s.filter(self, section)
	return section ~= "loopback" and section
end

function s.create(self, section)
	if TypedSection.create(self, section) then
		created = section
	end
end

function s.parse(self, ...)
	TypedSection.parse(self, ...)
	if created then
		luci.http.redirect(luci.http.getenv("REQUEST_URI") .. "/" .. created)
	end
end

up = s:option(Flag, "up")
up.stateful = true
function up.write(self, section, value)
	local call = value == "1" and "ifdown" or "ifup"
	os.execute(call .. " " .. section)
end

ipaddr = s:option(DummyValue, "ipaddr", translate("ipaddress"))
ipaddr.stateful = true

function ipaddr.cfgvalue(self, section)
	local ip = self.map:stateget(section, "ipaddr")
	local nm = self.map:stateget(section, "netmask")
	
	local parsed = ip and luci.ip.IPv4(ip, nm)
	return parsed and parsed:string() or ""
end

rx = s:option(DummyValue, "_rx")

function rx.cfgvalue(self, section)
	local ix = self.map:stateget(section, "ifname")
	local bt = netstat and netstat[ix] and netstat[ix][1]
	return bt and string.format("%.2f MB", tonumber(bt) / 1024 / 1024)
end

tx = s:option(DummyValue, "_tx")

function tx.cfgvalue(self, section)
	local ix = self.map:stateget(section, "ifname")
	local bt = netstat and netstat[ix] and netstat[ix][9]
	return bt and string.format("%.2f MB", tonumber(bt) / 1024 / 1024)
end

return m