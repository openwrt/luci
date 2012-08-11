--[[
LuCI - Lua Configuration Interface

Copyright 2011 Jo-Philipp Wich <xm@subsignal.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0
]]--

local map, section, net = ...

local ipaddr, adv_interface, adv_subnet
local adv_valid_lifetime, adv_preferred_lifetime, defaultroute, metric, ttl, mtu


ipaddr = section:taboption("general", Value, "ipaddr",
	translate("Local IPv4 address"),
	translate("Leave empty to use the current WAN address"))

ipaddr.datatype = "ip4addr"


adv_interface = section:taboption("general", Value, "adv_interface", translate("Advertise IPv6 on network"))
adv_interface.widget = "checkbox"
adv_interface.exclude = arg[1]
adv_interface.default = "lan"
adv_interface.template = "cbi/network_netlist"
adv_interface.nocreate = true
adv_interface.nobridges = true
adv_interface.novirtual = true

function adv_interface.write(self, section, value)
	if type(value) == "table" then
		Value.write(self, section, table.concat(value, " "))
	else
		Value.write(self, section, value)
	end
end

function adv_interface.remove(self, section)
	self:write(section, " ")
end

adv_subnet  = section:taboption("general", Value, "adv_subnet",
	translate("Advertised network ID"),
	translate("Allowed range is 1 to 65535"))

adv_subnet.placeholder = "1"
adv_subnet.datatype    = "range(1,65535)"

function adv_subnet.cfgvalue(self, section)
	local v = Value.cfgvalue(self, section)
	return v and tonumber(v, 16)
end

function adv_subnet .write(self, section, value)
	value = tonumber(value) or 1

	if value > 65535 then value = 65535
	elseif value < 1 then value = 1 end

	Value.write(self, section, "%X" % value)
end


adv_valid_lifetime = section:taboption("advanced", Value, "adv_valid_lifetime",
	translate("Use valid lifetime"),
	translate("Specifies the advertised valid prefix lifetime in seconds"))

adv_valid_lifetime.placeholder = "300"
adv_valid_lifetime.datatype    = "uinteger"


adv_preferred_lifetime = section:taboption("advanced", Value, "adv_preferred_lifetime",
	translate("Use preferred lifetime"),
	translate("Specifies the advertised preferred prefix lifetime in seconds"))

adv_preferred_lifetime.placeholder = "120"
adv_preferred_lifetime.datatype    = "uinteger"



defaultroute = section:taboption("advanced", Flag, "defaultroute",
	translate("Use default gateway"),
	translate("If unchecked, no default route is configured"))

defaultroute.default = defaultroute.enabled


metric = section:taboption("advanced", Value, "metric",
	translate("Use gateway metric"))

metric.placeholder = "0"
metric.datatype    = "uinteger"
metric:depends("defaultroute", defaultroute.enabled)


ttl = section:taboption("advanced", Value, "ttl", translate("Use TTL on tunnel interface"))
ttl.placeholder = "64"
ttl.datatype    = "range(1,255)"


mtu = section:taboption("advanced", Value, "mtu", translate("Use MTU on tunnel interface"))
mtu.placeholder = "1280"
mtu.datatype    = "max(1500)"
