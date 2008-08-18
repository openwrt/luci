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
m.stateful = true

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
function up.write(self, section, value)
	local call = value == "1" and "ifup" or "ifdown"
	os.execute(call .. " " .. section)
end

ifname = s:option(DummyValue, "ifname", translate("device"))
ifname.titleref = luci.dispatcher.build_url("admin", "network", "vlan")

if luci.model.uci.load("firewall") then
	zone = s:option(DummyValue, "_zone", translate("zone"))
	zone.titleref = luci.dispatcher.build_url("admin", "network", "firewall", "zones")

	function zone.cfgvalue(self, section)
		local zones = luci.tools.webadmin.network_get_zones(section)
		return zones and table.concat(zones, ", ") or "-"
	end
end

hwaddr = s:option(DummyValue, "_hwaddr")
function hwaddr.cfgvalue(self, section)
	local ix = self.map:get(section, "ifname") or ""
	return luci.fs.readfile("/sys/class/net/" .. ix .. "/address")
	 or luci.util.exec("ifconfig " .. ix):match(" ([A-F0-9:]+)%s*\n")
	 or "n/a"
	 
end


ipaddr = s:option(DummyValue, "ipaddr", translate("addresses"))

function ipaddr.cfgvalue(self, section)
	local addr = luci.tools.webadmin.network_get_addresses(section)
	return table.concat(addr, ", ")
end

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

return m