-- Copyright 2017 Dirk Brenken (dev@brenken.org)
-- This is free software, licensed under the Apache License, Version 2.0

local nw  = require("luci.model.network").init()
local fw  = require("luci.model.firewall").init()
local util = require("luci.util")
local uci = require("luci.model.uci").cursor()

m = SimpleForm("network", translate("Interface Setup"),
	translate("Automatically create a new wireless wan interface, configure it to use dhcp and " ..
	"add it to the wan zone of the firewall. This step has only to be done once."))
m.reset = false

iface = m:field(Value, "netname", translate("Name of the new wireless wan interface"),
	translate("The allowed characters are: <code>A-Z</code>, <code>a-z</code>, " ..
		"<code>0-9</code> and <code>_</code> (3-15 characters)."))
iface.default = "wwan"
iface.datatype = "and(uciname,minlength(3),maxlength(15))"

function iface.validate(self, value, section)
	local value = iface:formvalue(section)
	local name = uci.get("network", value)
	if name then
		iface:add_error(section, translate("The given network interface name already exist"))
	else
		iface.datatype = false
		iface.default = iface.disabled
		f = m:field(DummyValue, "textfield", "&nbsp;", translatef("Direct Link: "
			.. "<a href=\"%s\">"
			.. "Wireless Setup</a>", luci.dispatcher.build_url("admin/network/wireless")))
		f.default = translatef("Network Interface '%s' created successfully." ..
					" Feel free to scan & add new stations via standard wireless setup.", value)
		f.disabled = true
	end
	return value
end

function iface.write(self, section, value)
	local name = iface:formvalue(section)
	if name then
		local net = nw:add_network(name, { proto = "dhcp" })
		if net then
			nw:save("network")
			nw:commit("network")
			local zone = fw:get_zone_by_network("wan")
			if zone then
				zone:add_network(name)
				fw:save("firewall")
				fw:commit("firewall")
			end
		end
	end
end

return m
