--[[
LuCI - Lua Configuration Interface

Copyright 2010 Jo-Philipp Wich <xm@subsignal.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--

m = Map("radvd", translate("Radvd"),
	translate("Radvd is a router advertisement daemon for IPv6. " ..
		"It listens to router solicitations and sends router advertisements " ..
		"as described in RFC 4861."))

local nm = require "luci.model.network".init(m.uci)
local ut = require "luci.util"


--
-- Interfaces
--

s = m:section(TypedSection, "interface", translate("Interfaces"))
s.template = "cbi/tblsection"
s.extedit  = luci.dispatcher.build_url("admin/network/radvd/interface/%s")
s.anonymous = true
s.addremove = true

function s.create(...)
	local id = TypedSection.create(...)
	luci.http.redirect(s.extedit % id)
end

function s.remove(self, section)
	if m.uci:get("radvd", section) == "interface" then
		local iface = m.uci:get("radvd", section, "interface")
		if iface then
			m.uci:delete_all("radvd", "prefix",
				function(s) return s.interface == iface end)

			m.uci:delete_all("radvd", "route",
				function(s) return s.interface == iface end)

			m.uci:delete_all("radvd", "rdnss",
				function(s) return s.interface == iface end)
		end
	end

	return TypedSection.remove(self, section)
end

o = s:option(Flag, "ignore", translate("Enable"))
o.rmempty = false
o.width   = "30px"
function o.cfgvalue(...)
	local v = Flag.cfgvalue(...)
	return v == "1" and "0" or "1"
end
function o.write(self, section, value)
	Flag.write(self, section, value == "1" and "0" or "1")
end

o = s:option(DummyValue, "interface", translate("Interface"))
o.template = "cbi/network_netinfo"
o.width    = "10%"

o = s:option(DummyValue, "UnicastOnly", translate("Multicast"))
function o.cfgvalue(self, section)
	local v  = Value.cfgvalue(self, section)
	local v2 = m.uci:get("radvd", section, "client")
	return (v == "1" or (v2 and #v2 > 0)) and translate("no") or translate("yes")
end

o = s:option(DummyValue, "AdvSendAdvert", translate("Advertising"))
function o.cfgvalue(...)
	local v = Value.cfgvalue(...)
	return v == "1" and translate("yes") or translate("no")
end

o = s:option(DummyValue, "MaxRtrAdvInterval", translate("Max. interval"))
function o.cfgvalue(...)
	local v = Value.cfgvalue(...) or "600"
	return v .. "s"
end

o = s:option(DummyValue, "AdvHomeAgentFlag", translate("Mobile IPv6"))
function o.cfgvalue(...)
	local v = Value.cfgvalue(...)
	return v == "1" and translate("yes") or translate("no")
end

o = s:option(DummyValue, "AdvDefaultPreference", translate("Preference"))
function o.cfgvalue(...)
	local v = Value.cfgvalue(...) or "medium"
	return translate(v)
end


--
-- Prefixes
--

s2 = m:section(TypedSection, "prefix", translate("Prefixes"))
s2.template = "cbi/tblsection"
s2.extedit  = luci.dispatcher.build_url("admin/network/radvd/prefix/%s")
s2.addremove = true
s2.anonymous = true

function s2.create(...)
	local id = TypedSection.create(...)
	luci.http.redirect(s2.extedit % id)
end


o = s2:option(Flag, "ignore", translate("Enable"))
o.rmempty = false
o.width   = "30px"
function o.cfgvalue(...)
	local v = Flag.cfgvalue(...)
	return v == "1" and "0" or "1"
end
function o.write(self, section, value)
	Flag.write(self, section, value == "1" and "0" or "1")
end

o = s2:option(DummyValue, "interface", translate("Interface"))
o.template = "cbi/network_netinfo"
o.width    = "10%"

pfx = s2:option(DummyValue, "prefix", translate("Prefix"))
pfx.width = "60%"
function pfx.cfgvalue(self, section)
	local v = m.uci:get_list("radvd", section, self.option)
	local l = { }

	if not v or #v == 0 or (#v == 1 and #v[1] == 0) then
		local net = nm:get_network(m.uci:get("radvd", section, "interface"))
		if net then
			local ifc = nm:get_interface(net:ifname())
			if ifc then
				local adr
				for _, adr in ipairs(ifc:ip6addrs()) do
					if not adr:is6linklocal() then
						v = adr:string()
						break
					end
				end
			end
		end
	end

	for v in ut.imatch(v) do
		v = luci.ip.IPv6(v)
		if v then
			l[#l+1] = v:string()
		end
	end

	if #l == 0 then
		l[1] = "?"
	end

	return table.concat(l, ", ")
end

o = s2:option(DummyValue, "AdvAutonomous", translate("Autonomous"))
function o.cfgvalue(...)
	local v = Value.cfgvalue(...)
	return v == "1" and translate("yes") or translate("no")
end

o = s2:option(DummyValue, "AdvOnLink", translate("On-link"))
function o.cfgvalue(...)
	local v = Value.cfgvalue(...)
	return v == "1" and translate("yes") or translate("no")
end

o = s2:option(DummyValue, "AdvValidLifetime", translate("Validity time"))
function o.cfgvalue(...)
	local v = Value.cfgvalue(...) or "86400"
	return translate(v)
end


--
-- Routes
--

s3 = m:section(TypedSection, "route", translate("Routes"))
s3.template = "cbi/tblsection"
s3.extedit  = luci.dispatcher.build_url("admin/network/radvd/route/%s")
s3.addremove = true
s3.anonymous = true

function s3.create(...)
	local id = TypedSection.create(...)
	luci.http.redirect(s3.extedit % id)
end


o = s3:option(Flag, "ignore", translate("Enable"))
o.rmempty = false
o.width   = "30px"
function o.cfgvalue(...)
	local v = Flag.cfgvalue(...)
	return v == "1" and "0" or "1"
end
function o.write(self, section, value)
	Flag.write(self, section, value == "1" and "0" or "1")
end

o = s3:option(DummyValue, "interface", translate("Interface"))
o.template = "cbi/network_netinfo"
o.width    = "10%"

o = s3:option(DummyValue, "prefix", translate("Prefix"))
o.width = "60%"
o.cfgvalue = pfx.cfgvalue

o = s3:option(DummyValue, "AdvRouteLifetime", translate("Lifetime"))
function o.cfgvalue(self, section)
	local v = Value.cfgvalue(self, section) or "1800"
	return translate(v)
end

o = s3:option(DummyValue, "AdvRoutePreference", translate("Preference"))
function o.cfgvalue(self, section)
	local v = Value.cfgvalue(self, section) or "medium"
	return translate(v)
end


--
-- RDNSS
--

s4 = m:section(TypedSection, "rdnss", translate("RDNSS"))
s4.template = "cbi/tblsection"
s4.extedit  = luci.dispatcher.build_url("admin/network/radvd/rdnss/%s")
s4.addremove = true
s4.anonymous = true

function s4.create(...)
	local id = TypedSection.create(...)
	luci.http.redirect(s4.extedit % id)
end


o = s4:option(Flag, "ignore", translate("Enable"))
o.rmempty = false
o.width   = "30px"
function o.cfgvalue(...)
	local v = Flag.cfgvalue(...)
	return v == "1" and "0" or "1"
end
function o.write(self, section, value)
	Flag.write(self, section, value == "1" and "0" or "1")
end

o = s4:option(DummyValue, "interface", translate("Interface"))
o.template = "cbi/network_netinfo"
o.width    = "10%"

o = s4:option(DummyValue, "addr", translate("Address"))
o.width = "60%"
o.cfgvalue = pfx.cfgvalue

o = s4:option(DummyValue, "AdvRDNSSLifetime", translate("Lifetime"))
function o.cfgvalue(self, section)
	local v = Value.cfgvalue(self, section) or "1200"
	return translate(v)
end


--
-- DNSSL
--

s5 = m:section(TypedSection, "dnssl", translate("DNSSL"))
s5.template = "cbi/tblsection"
s5.extedit  = luci.dispatcher.build_url("admin/network/radvd/dnssl/%s")
s5.addremove = true
s5.anonymous = true

function s5.create(...)
	local id = TypedSection.create(...)
	luci.http.redirect(s5.extedit % id)
end


o = s5:option(Flag, "ignore", translate("Enable"))
o.rmempty = false
o.width   = "30px"
function o.cfgvalue(...)
	local v = Flag.cfgvalue(...)
	return v == "1" and "0" or "1"
end
function o.write(self, section, value)
	Flag.write(self, section, value == "1" and "0" or "1")
end

o = s5:option(DummyValue, "interface", translate("Interface"))
o.template = "cbi/network_netinfo"
o.width    = "10%"

o = s5:option(DummyValue, "suffix", translate("Suffix"))
o.width = "60%"
function o.cfgvalue(self, section)
	local v = m.uci:get_list("radvd", section, "suffix")
	local l = { }

	for v in ut.imatch(v) do
		l[#l+1] = v
	end

	if #l == 0 then
		l[1] = "?"
	end

	return table.concat(l, ", ")
end

o = s5:option(DummyValue, "AdvDNSSLLifetime", translate("Lifetime"))
function o.cfgvalue(self, section)
	local v = Value.cfgvalue(self, section) or "1200"
	return translate(v)
end


return m
