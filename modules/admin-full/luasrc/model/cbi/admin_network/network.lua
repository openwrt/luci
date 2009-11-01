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

local sys = require "luci.sys"
local wa  = require "luci.tools.webadmin"
local fs  = require "nixio.fs"

local netstate = luci.model.uci.cursor_state():get_all("network")
m = Map("network", translate("Interfaces"))

local created
local netstat = sys.net.deviceinfo()

s = m:section(TypedSection, "interface", "")
s.addremove = true
s.extedit   = luci.dispatcher.build_url("admin", "network", "network") .. "/%s"
s.template  = "cbi/tblsection"
s.override_scheme = true

function s.filter(self, section)
	return section ~= "loopback" and section
end

function s.create(self, section)
	if TypedSection.create(self, section) then
		created = section
	else
		self.invalid_cts = true
	end
end

function s.parse(self, ...)
	TypedSection.parse(self, ...)
	if created then
		m.uci:save("network")
		luci.http.redirect(luci.dispatcher.build_url("admin", "network", "network")
		 .. "/" .. created)
	end
end

up = s:option(Flag, "up")
function up.cfgvalue(self, section)
	return netstate[section] and netstate[section].up or "0"
end

function up.write(self, section, value)
	local call
	if value == "1" then
		call = "ifup"
	elseif value == "0" then
		call = "ifdown"
	end
	os.execute(call .. " " .. section .. " >/dev/null 2>&1")
end

ifname = s:option(DummyValue, "ifname", translate("Device"))
function ifname.cfgvalue(self, section)
	return netstate[section] and netstate[section].ifname
end

ifname.titleref = luci.dispatcher.build_url("admin", "network", "vlan")


if luci.model.uci.cursor():load("firewall") then
	zone = s:option(DummyValue, "_zone", translate("Zone"))
	zone.titleref = luci.dispatcher.build_url("admin", "network", "firewall", "zones")

	function zone.cfgvalue(self, section)
		return table.concat(wa.network_get_zones(section) or { "-" }, ", ")
	end
end

hwaddr = s:option(DummyValue, "_hwaddr")
function hwaddr.cfgvalue(self, section)
	local ix = self.map:get(section, "ifname") or ""
	return fs.readfile("/sys/class/net/" .. ix .. "/address")
	 or luci.util.exec("ifconfig " .. ix):match(" ([A-F0-9:]+)%s*\n")
	 or "n/a"
end


ipaddr = s:option(DummyValue, "ipaddr", translate("Addresses"))
function ipaddr.cfgvalue(self, section)
	return table.concat(wa.network_get_addresses(section), ", ")
end

txrx = s:option(DummyValue, "_txrx")

function txrx.cfgvalue(self, section)
	local ix = self.map:get(section, "ifname")

	local rx = netstat and netstat[ix] and netstat[ix][1]
	rx = rx and wa.byte_format(tonumber(rx)) or "-"

	local tx = netstat and netstat[ix] and netstat[ix][9]
	tx = tx and wa.byte_format(tonumber(tx)) or "-"

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
