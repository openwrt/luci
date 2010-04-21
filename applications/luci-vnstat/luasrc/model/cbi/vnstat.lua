--[[
LuCI - Lua Configuration Interface

Copyright 2010 Jo-Philipp Wich <xm@subsignal.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0
]]--

local utl = require "luci.util"
local sys = require "luci.sys"
local fs  = require "nixio.fs"
local nw  = require "luci.model.network"

local dbdir, line

for line in io.lines("/etc/vnstat.conf") do
	dbdir = line:match("^%s*DatabaseDir%s+[\"'](%S-)[\"']")
	if dbdir then break end
end

dbdir = dbdir or "/var/lib/vnstat"


m = SimpleForm("vnstat", translate("VnStat"),
	translate("VnStat is a network traffic monitor for Linux that keeps a log of network traffic for the selected interface(s)."))

m.submit = translate("Restart VnStat")
m.reset  = false

nw.init(luci.model.uci.cursor_state())

local ifaces = { }
local enabled = { }
local iface

for iface in fs.dir(dbdir) do
	if iface:sub(1,1) ~= '.' then
		ifaces[iface] = iface
		enabled[iface] = iface
	end
end

for _, iface in ipairs(sys.net.devices()) do
	ifaces[iface] = iface
end


local s = m:section(SimpleSection)

mon_ifaces = s:option(Value, "ifaces", translate("Monitor selected interfaces"))
mon_ifaces.template = "cbi/network_ifacelist"
mon_ifaces.widget   = "checkbox"
mon_ifaces.default  = utl.keys(enabled)

function mon_ifaces.write(self, s, val)
	local i
	local s = { }

	if val then
		for _, i in ipairs(type(val) == "table" and val or { val }) do
			s[i] = true
		end
	end

	for i, _ in pairs(ifaces) do
		if s[i] then
			sys.call("vnstat -u -i %q" % i)
		else
			fs.unlink(dbdir .. "/" .. i)
			fs.unlink(dbdir .. "/." .. i)
		end
	end


	sys.call("/etc/init.d/vnstat restart >/dev/null 2>/dev/null")

	m.message = "<p><strong>%s</strong></p>"
		% translate("The VnStat service has been restarted."), cmd

	self.default = utl.keys(s)
end

mon_ifaces.remove = mon_ifaces.write

return m

