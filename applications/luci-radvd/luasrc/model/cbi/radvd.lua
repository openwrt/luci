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
	local iface = m.uci:get("radvd", section, "interface")
	if iface then
		m.uci:delete_all("radvd", "prefix",
			function(s) return s.interface == iface end)

		m.uci:delete_all("radvd", "route",
			function(s) return s.interface == iface end)

		m.uci:delete_all("radvd", "rdnss",
			function(s) return s.interface == iface end)
	end

	return TypedSection.remove(self, section)
end


o = s:option(DummyValue, "interface", translate("Interface"))
o.template = "cbi/network_netinfo"

o = s:option(DummyValue, "UnicastOnly", translate("Multicast"))
function o.cfgvalue(...)
	local v = Value.cfgvalue(...)
	return v == "1" and translate("no") or translate("yes")
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


o = s2:option(DummyValue, "interface", translate("Interface"))
o.template = "cbi/network_netinfo"

o = s2:option(DummyValue, "prefix", translate("Prefix"))
function o.cfgvalue(self, section)
	local v = Value.cfgvalue(self, section)
	if not v then
		local net = nm:get_network(m.uci:get("radvd", section, "interface"))
		if net then
			local ifc = nm:get_interface(net:ifname())
			if ifc then
				local adr
				local lla = luci.ip.IPv6("fe80::/10")
				for _, adr in ipairs(ifc:ip6addrs()) do
					if not lla:contains(adr) then
						v = adr:string()
						break
					end
				end
			end
		end
	else
		v = luci.ip.IPv6(v)
		v = v and v:string()
	end

	return v or "?"
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


o = s3:option(DummyValue, "interface", translate("Interface"))
o.template = "cbi/network_netinfo"

o = s3:option(DummyValue, "prefix", translate("Prefix"))
function o.cfgvalue(self, section)
	local v = Value.cfgvalue(self, section)
	if v then
		v = luci.ip.IPv6(v)
		v = v and v:string()
	end
	return v or "?"
end

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

function s.create(...)
	local id = TypedSection.create(...)
	luci.http.redirect(s4.extedit % id)
end


o = s4:option(DummyValue, "interface", translate("Interface"))
o.template = "cbi/network_netinfo"

o = s4:option(DummyValue, "addr", translate("Address"))
function o.cfgvalue(self, section)
	local v = Value.cfgvalue(self, section)
	if not v then
		local net = nm:get_network(m.uci:get("radvd", section, "interface"))
		if net then
			local ifc = nm:get_interface(net:ifname())
			if ifc then
				local adr
				local lla = luci.ip.IPv6("fe80::/10")
				for _, adr in ipairs(ifc:ip6addrs()) do
					if not lla:contains(adr) then
						v = adr:network(128):string()
						break
					end
				end
			end
		end
	else
		v = luci.ip.IPv6(v)
		v = v and v:network(128):string()
	end

	return v or "?"
end

o = s4:option(DummyValue, "AdvRDNSSOpen", translate("Open"))
function o.cfgvalue(self, section)
	local v = Value.cfgvalue(self, section)
	return v == "1" and translate("yes") or translate("no")
end

o = s4:option(DummyValue, "AdvRDNSSLifetime", translate("Lifetime"))
function o.cfgvalue(self, section)
	local v = Value.cfgvalue(self, section) or "1200"
	return translate(v)
end


return m
