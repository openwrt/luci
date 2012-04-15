--[[
LuCI - Lua Configuration Interface

Copyright 2010 Jo-Philipp Wich <xm@subsignal.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--

local sid = arg[1]
local utl = require "luci.util"

m = Map("radvd", translatef("Radvd - Prefix"),
	translate("Radvd is a router advertisement daemon for IPv6. " ..
		"It listens to router solicitations and sends router advertisements " ..
		"as described in RFC 4861."))

m.redirect = luci.dispatcher.build_url("admin/network/radvd")

if m.uci:get("radvd", sid) ~= "prefix" then
	luci.http.redirect(m.redirect)
	return
end


s = m:section(NamedSection, sid, "interface", translate("Prefix Configuration"))
s.addremove = false

s:tab("general", translate("General"))
s:tab("advanced",  translate("Advanced"))


--
-- General
--

o = s:taboption("general", Flag, "ignore", translate("Enable"))
o.rmempty = false

function o.cfgvalue(...)
	local v = Flag.cfgvalue(...)
	return v == "1" and "0" or "1"
end

function o.write(self, section, value)
	Flag.write(self, section, value == "1" and "0" or "1")
end


o = s:taboption("general", Value, "interface", translate("Interface"),
	translate("Specifies the logical interface name this section belongs to"))

o.template = "cbi/network_netlist"
o.nocreate = true
o.optional = false

function o.formvalue(...)
	return Value.formvalue(...) or "-"
end

function o.validate(self, value)
	if value == "-" then
		return nil, translate("Interface required")
	end
	return value
end

function o.write(self, section, value)
	m.uci:set("radvd", section, "ignore", 0)
	m.uci:set("radvd", section, "interface", value)
end


o = s:taboption("general", DynamicList, "prefix", translate("Prefixes"),
	translate("Advertised IPv6 prefixes. If empty, the current interface prefix is used"))

o.optional    = true
o.datatype    = "ip6addr"
o.placeholder = translate("default")
function o.cfgvalue(self, section)
	local l = { }
	local v = m.uci:get_list("radvd", section, "prefix")
	for v in utl.imatch(v) do
		l[#l+1] = v
	end
	return l
end


o = s:taboption("general", Flag, "AdvOnLink", translate("On-link determination"),
	translate("Indicates that this prefix can be used for on-link determination (RFC4861)"))

o.rmempty = false
o.default = "1"


o = s:taboption("general", Flag, "AdvAutonomous", translate("Autonomous"),
	translate("Indicates that this prefix can be used for autonomous address configuration (RFC4862)"))

o.rmempty = false
o.default = "1"


--
-- Advanced
--

o = s:taboption("advanced", Flag, "AdvRouterAddr", translate("Advertise router address"),
	translate("Indicates that the address of interface is sent instead of network prefix, as is required by Mobile IPv6"))


o = s:taboption("advanced", Value, "AdvValidLifetime", translate("Valid lifetime"),
	translate("Advertises the length of time in seconds that the prefix is valid for the purpose of on-link determination."))

o.datatype = 'or(uinteger,"infinity")'
o.placeholder = 86400


o = s:taboption("advanced", Value, "AdvPreferredLifetime", translate("Preferred lifetime"),
	translate("Advertises the length of time in seconds that addresses generated from the prefix via stateless address autoconfiguration remain preferred."))

o.datatype = 'or(uinteger,"infinity")'
o.placeholder = 14400


o = s:taboption("advanced", Value, "Base6to4Interface", translate("6to4 interface"),
	translate("Specifies a logical interface name to derive a 6to4 prefix from. The interfaces public IPv4 address is combined with 2002::/3 and the value of the prefix option"))

o.template = "cbi/network_netlist"
o.nocreate = true
o.unspecified = true


return m
