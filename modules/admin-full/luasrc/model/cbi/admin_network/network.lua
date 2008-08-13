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
require("luci.tools.webadmin")


m = Map("network", translate("interfaces"))

local created
local netstat = luci.sys.net.deviceinfo()

s = m:section(TypedSection, "interface", "")
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

ifname = s:option(DummyValue, "ifname", translate("device"))
ifname.stateful = true

hwaddr = s:option(DummyValue, "_hwaddr")
function hwaddr.cfgvalue(self, section)
	local ix = self.map:stateget(section, "ifname") or ""
	return luci.fs.readfile("/sys/class/net/" .. ix .. "/address") or "n/a"
end


ipaddr = s:option(DummyValue, "ipaddr", translate("addresses"))

function ipaddr.cfgvalue(self, section)
	local addr = luci.tools.webadmin.network_get_addresses(section)
	return table.concat(addr, ", ")
end

txrx = s:option(DummyValue, "_txrx")

function txrx.cfgvalue(self, section)
	local ix = self.map:stateget(section, "ifname")
	
	local rx = netstat and netstat[ix] and netstat[ix][1]
	rx = rx and luci.tools.webadmin.byte_format(tonumber(rx)) or "-"
	
	local tx = netstat and netstat[ix] and netstat[ix][9]
	tx = tx and luci.tools.webadmin.byte_format(tonumber(tx)) or "-"
	
	return string.format("%s / %s", tx, rx)
end

errors = s:option(DummyValue, "_err")

function errors.cfgvalue(self, section)
	local ix = self.map:stateget(section, "ifname")
	
	local rx = netstat and netstat[ix] and netstat[ix][3]
	local tx = netstat and netstat[ix] and netstat[ix][11]
	
	rx = rx and tostring(rx) or "-"
	tx = tx and tostring(tx) or "-"
	
	return string.format("%s / %s", tx, rx)
end

return m