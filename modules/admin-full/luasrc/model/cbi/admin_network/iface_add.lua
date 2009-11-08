--[[
LuCI - Lua Configuration Interface

Copyright 2009 Jo-Philipp Wich <xm@subsignal.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--

local nw  = require "luci.model.network"
local fw  = require "luci.model.firewall"
local uci = require "luci.model.uci".cursor()

m = SimpleForm("network", translate("Create Or Attach Network"),
	translate("If the interface is attached to an existing network it will be <em>bridged</em> " ..
		"to the existing interfaces and is covered by the firewall zone of the choosen network.<br />" ..
		"Uncheck the attach option to define a new standalone network for this interface."
	))

nw.init(uci)
fw.init(uci)

attachnet = m:field(Flag, "_attach", translate("Attach to existing network"))
attachnet.rmempty = false
attachnet.default = "1"

newnet = m:field(Value, "_netname_new", translate("Name of the new network"),
	translate("The allowed characters are: <code>A-Z</code>, <code>a-z</code>, " ..
		"<code>0-9</code> and <code>_</code>"
	))

newnet:depends("_attach", "")
newnet.default = arg[1] and "net_" .. arg[1]:gsub("[^%w_]+", "_")

addnet = m:field(Value, "_netname_attach",
	translate("Network to attach interface to"))

addnet.template = "cbi/network_netlist"
addnet.widget = "radio"
addnet.nocreate = true
addnet:depends("_attach", "1")

fwzone = m:field(Value, "_fwzone",
	translate("Create / Assign firewall-zone"),
	translate("Choose the firewall zone you want to assign to this interface. Select <em>unspecified</em> to remove the interface from the associated zone or fill out the <em>create</em> field to define a new zone and attach the interface to it."))

fwzone.template = "cbi/firewall_zonelist"
addnet.widget = "radio"
fwzone:depends("_attach", "")
fwzone.default = arg[1] and "zone_" .. arg[1]:gsub("[^%w_]+", "_")


function attachnet.write(self, section, value)
	local net, zone

	if value == "1" then
		net = nw:get_network(addnet:formvalue(section))
		if net then
			net:type("bridge")
		end
	else
		local zval = fwzone:formvalue(section)
		
		net = nw:add_network(newnet:formvalue(section), { proto  = "none" })
		zone = fw:get_zone(zval)

		if not zone and zval == '-' then
			zval = m:formvalue(fwzone:cbid(section) .. ".newzone")
			if zval and #zval > 0 then
				zone = fw:add_zone(zval)
			else
				fw:del_network(arg[1])
			end
		end
	end

	if not net then
		self.error = { [section] = "missing" }
	else
		net:add_interface(arg[1])

		if zone then
			fw:del_network(net:name())
			zone:add_network(net:name())
		end

		uci:save("wireless")
		uci:save("network")
		uci:save("firewall")
		luci.http.redirect(luci.dispatcher.build_url("admin/network/network", net:name()))
	end
end

function fwzone.cfgvalue(self, section)
	self.iface = section
	local z = fw:get_zone_by_network(section)
	return z and z:name()
end

return m
