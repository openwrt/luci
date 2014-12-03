--[[
LuCI - Lua Configuration Interface

Copyright 2011 Manuel Munz <freifunk at somakoma de>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0
]]--

local uci = require "luci.model.uci".cursor()

m = Map("freifunk-policyrouting", translate("Policy Routing"), translate("These pages can be used to setup policy routing for certain firewall zones. "..
	"This is useful if you need to use your own internet connection for yourself but you don't want to share it with others (thats why it can also be "..
	"called 'Ego Mode'). Your own traffic is then sent via your internet connection while traffic originating from the mesh will use another gateway in the mesh. "))
m:chain("network")

c = m:section(NamedSection, "pr", "settings", "")

local pr = c:option(Flag, "enable", translate("Enable Policy Routing"))
pr.rmempty = false

local strict = c:option(Flag, "strict", translate("Strict Filtering"), translate("If no default route is received from the mesh network then traffic which belongs to "..
	"the selected firewall zones is routed via your internet connection as a fallback. If you do not want this and instead block that traffic then you should "..
	"select this option."))
strict.rmempty = false

local fallback = c:option(Flag, "fallback", translate("Fallback to mesh"),
	translate("If your own gateway is not available then fallback to the mesh default gateway."))
strict.rmempty = false

local zones = c:option(MultiValue, "zones", translate("Firewall zones"), translate("All traffic from interfaces belonging to these zones will be sent via "..
	"a gateway in the mesh network."))
uci:foreach("firewall", "zone", function(section)
	local name = section.name
	if not (name == "wan") then
		zones:value(name)
	end
end)

return m
