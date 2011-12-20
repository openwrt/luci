--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--

local ds = require "luci.dispatcher"
local ft = require "luci.tools.firewall"

m = Map("firewall", translate("Firewall - Port Forwards"),
	translate("Port forwarding allows remote computers on the Internet to \
	           connect to a specific computer or service within the \
	           private LAN."))

--
-- Port Forwards
--

s = m:section(TypedSection, "redirect", translate("Port Forwards"))
s.template  = "cbi/tblsection"
s.addremove = true
s.anonymous = true
s.sortable  = true
s.extedit   = ds.build_url("admin/network/firewall/forwards/%s")
s.template_addremove = "firewall/cbi_addforward"

function s.create(self, section)
	local n = m:formvalue("_newfwd.name")
	local p = m:formvalue("_newfwd.proto")
	local e = m:formvalue("_newfwd.extport")
	local a = m:formvalue("_newfwd.intaddr")
	local i = m:formvalue("_newfwd.intport")

	if p == "other" or (p and a) then
		created = TypedSection.create(self, section)

		self.map:set(created, "target",    "DNAT")
		self.map:set(created, "src",       "wan")
		self.map:set(created, "dest",      "lan")
		self.map:set(created, "proto",     (p ~= "other") and p or "all")
		self.map:set(created, "src_dport", e)
		self.map:set(created, "dest_ip",   a)
		self.map:set(created, "dest_port", i)
		self.map:set(created, "name",      n)
	end

	if p ~= "other" then
		created = nil
	end
end

function s.parse(self, ...)
	TypedSection.parse(self, ...)
	if created then
		m.uci:save("firewall")
		luci.http.redirect(ds.build_url(
			"admin/network/firewall/redirect", created
		))
	end
end

function s.filter(self, sid)
	return (self.map:get(sid, "target") ~= "SNAT")
end


ft.opt_name(s, DummyValue, translate("Name"))


proto = s:option(DummyValue, "proto", translate("Protocol"))
proto.rawhtml = true
function proto.cfgvalue(self, s)
	return ft.fmt_proto(self.map:get(s, "proto")) or "Any"
end


src = s:option(DummyValue, "src", translate("Source"))
src.rawhtml = true
src.width   = "20%"
function src.cfgvalue(self, s)
	local z = ft.fmt_zone(self.map:get(s, "src"), translate("any zone"))
	local a = ft.fmt_ip(self.map:get(s, "src_ip"), translate("any host"))
	local p = ft.fmt_port(self.map:get(s, "src_port"))
	local m = ft.fmt_mac(self.map:get(s, "src_mac"))

	if p and m then
		return translatef("From %s in %s with source %s and %s", a, z, p, m)
	elseif p or m then
		return translatef("From %s in %s with source %s", a, z, p or m)
	else
		return translatef("From %s in %s", a, z)
	end
end

via = s:option(DummyValue, "via", translate("Via"))
via.rawhtml = true
via.width   = "20%"
function via.cfgvalue(self, s)
	local a = ft.fmt_ip(self.map:get(s, "src_dip"), translate("any router IP"))
	local p = ft.fmt_port(self.map:get(s, "src_dport"))

	if p then
		return translatef("To %s at %s", a, p)
	else
		return translatef("To %s", a)
	end
end

dest = s:option(DummyValue, "dest", translate("Destination"))
dest.rawhtml = true
dest.width   = "30%"
function dest.cfgvalue(self, s)
	local z = ft.fmt_zone(self.map:get(s, "dest"), translate("any zone"))
	local a = ft.fmt_ip(self.map:get(s, "dest_ip"), translate("any host"))
	local p = ft.fmt_port(self.map:get(s, "dest_port")) or
		ft.fmt_port(self.map:get(s, "src_dport"))

	if p then
		return translatef("Forward to %s, %s in %s", a, p, z)
	else
		return translatef("Forward to %s in %s", a, z)
	end
end

ft.opt_enabled(s, Flag, translate("Enable")).width = "1%"

return m
