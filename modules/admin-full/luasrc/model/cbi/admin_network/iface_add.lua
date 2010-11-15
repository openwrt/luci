--[[
LuCI - Lua Configuration Interface

Copyright 2009-2010 Jo-Philipp Wich <xm@subsignal.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$

]]--

local nw  = require "luci.model.network".init()
local fw  = require "luci.model.firewall".init()
local utl = require "luci.util"
local uci = require "luci.model.uci".cursor()

m = SimpleForm("network", translate("Create Interface"))

newnet = m:field(Value, "_netname", translate("Name of the new interface"),
	translate("The allowed characters are: <code>A-Z</code>, <code>a-z</code>, " ..
		"<code>0-9</code> and <code>_</code>"
	))

newnet:depends("_attach", "")
newnet.default = arg[1] and "net_" .. arg[1]:gsub("[^%w_]+", "_")
newnet.datatype = "uciname"

netbridge = m:field(Flag, "_bridge", translate("Create a bridge over multiple interfaces"))


sifname = m:field(Value, "_ifname", translate("Cover the following interface"),
	translate("Note: If you choose an interface here which is part of another network, it will be moved into this network."))

sifname.widget = "radio"
sifname.template = "cbi/network_ifacelist"
sifname.nobridges = true
sifname:depends("_bridge", "")


mifname = m:field(Value, "_ifnames", translate("Cover the following interfaces"),
	translate("Note: If you choose an interface here which is part of another network, it will be moved into this network."))

mifname.widget = "checkbox"
mifname.template = "cbi/network_ifacelist"
mifname.nobridges = true
mifname:depends("_bridge", "1")

function newnet.write(self, section, value)
	local bridge = netbridge:formvalue(section) == "1"
	local ifaces = bridge and mifname:formvalue(section) or sifname:formvalue(section)

	local nn = nw:add_network(value, { proto = "none" })
	if nn then
		if bridge then
			nn:set("type", "bridge")
		end

		local iface
		for iface in utl.imatch(ifaces) do
			nn:add_interface(iface)
			if not bridge then
				break
			end
		end

		nw:save("network")
		nw:save("wireless")

		luci.http.redirect(luci.dispatcher.build_url("admin/network/network", nn:name()))
	end
end

return m
