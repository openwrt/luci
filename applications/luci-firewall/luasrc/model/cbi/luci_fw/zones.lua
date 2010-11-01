--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--

local nw = require "luci.model.network"
local fw = require "luci.model.firewall"
local ds = require "luci.dispatcher"

local has_v2 = nixio.fs.access("/lib/firewall/fw.sh")

require("luci.tools.webadmin")
m = Map("firewall", translate("Firewall"), translate("The firewall creates zones over your network interfaces to control network traffic flow."))

fw.init(m.uci)
nw.init(m.uci)

s = m:section(TypedSection, "defaults")
s.anonymous = true
s.addremove = false

s:tab("general", translate("General Settings"))
s:tab("custom", translate("Custom Rules"))


s:taboption("general", Flag, "syn_flood", translate("Enable SYN-flood protection"))

local di = s:taboption("general", Flag, "drop_invalid", translate("Drop invalid packets"))
di.rmempty = false
function di.cfgvalue(...)
	return AbstractValue.cfgvalue(...) or "1"
end

p = {}
p[1] = s:taboption("general", ListValue, "input", translate("Input"))
p[2] = s:taboption("general", ListValue, "output", translate("Output"))
p[3] = s:taboption("general", ListValue, "forward", translate("Forward"))

for i, v in ipairs(p) do
	v:value("REJECT", translate("reject"))
	v:value("DROP", translate("drop"))
	v:value("ACCEPT", translate("accept"))
end

custom = s:taboption("custom", Value, "_custom",
	translate("Custom Rules (/etc/firewall.user)"))

custom.template = "cbi/tvalue"
custom.rows = 20

function custom.cfgvalue(self, section)
	return nixio.fs.readfile("/etc/firewall.user")
end

function custom.write(self, section, value)
	nixio.fs.writefile("/etc/firewall.user", value)
end


s = m:section(TypedSection, "zone", translate("Zones"))
s.template = "cbi/tblsection"
s.anonymous = true
s.addremove = true
s.extedit   = ds.build_url("admin", "network", "firewall", "zones", "%s")

function s.create(self)
	local z = fw:new_zone()
	if z then
		luci.http.redirect(
			ds.build_url("admin", "network", "firewall", "zones", z.sid)
		)
	end
end

info = s:option(DummyValue, "_info", translate("Zone ⇒ Forwardings"))
info.template = "cbi/firewall_zoneforwards"
function info.cfgvalue(self, section)
	return self.map:get(section, "name")
end

p = {}
p[1] = s:option(ListValue, "input", translate("Input"))
p[2] = s:option(ListValue, "output", translate("Output"))
p[3] = s:option(ListValue, "forward", translate("Forward"))

for i, v in ipairs(p) do
	v:value("REJECT", translate("reject"))
	v:value("DROP", translate("drop"))
	v:value("ACCEPT", translate("accept"))
end

s:option(Flag, "masq", translate("Masquerading"))
s:option(Flag, "mtu_fix", translate("MSS clamping"))


local created = nil

--
-- Redirects
--

s = m:section(TypedSection, "redirect", translate("Redirections"))
s.template  = "cbi/tblsection"
s.addremove = true
s.anonymous = true
s.extedit   = ds.build_url("admin", "network", "firewall", "redirect", "%s")

function s.create(self, section)
	created = TypedSection.create(self, section)
end

function s.parse(self, ...)
	TypedSection.parse(self, ...)
	if created then
		m.uci:save("firewall")
		luci.http.redirect(ds.build_url(
			"admin", "network", "firewall", "redirect", created
		))
	end
end

name = s:option(DummyValue, "_name", translate("Name"))
function name.cfgvalue(self, s)
	return self.map:get(s, "_name") or "-"
end

proto = s:option(DummyValue, "proto", translate("Protocol"))
function proto.cfgvalue(self, s)
	local p = self.map:get(s, "proto")
	if not p or p == "tcpudp" then
		return "TCP+UDP"
	else
		return p:upper()
	end
end

src = s:option(DummyValue, "src", translate("Source"))
function src.cfgvalue(self, s)
	local rv = "%s:%s:%s" % {
		self.map:get(s, "src") or "*",
		self.map:get(s, "src_ip") or "0.0.0.0/0",
		self.map:get(s, "src_port") or "*"
	}

	local mac = self.map:get(s, "src_mac")
	if mac then
		rv = rv .. ", MAC " .. mac
	end

	return rv
end

via = s:option(DummyValue, "via", translate("Via"))
function via.cfgvalue(self, s)
	return "%s:%s:%s" % {
		translate("Device"),
		self.map:get(s, "src_dip") or "0.0.0.0/0",
		self.map:get(s, "src_dport") or "*"
	}
end

dest = s:option(DummyValue, "dest", translate("Destination"))
function dest.cfgvalue(self, s)
	return "%s:%s:%s" % {
		self.map:get(s, "dest") or "*",
		self.map:get(s, "dest_ip") or "0.0.0.0/0",
		self.map:get(s, "dest_port") or "*"
	}
end

target = s:option(DummyValue, "target", translate("Action"))
function target.cfgvalue(self, s)
	return self.map:get(s, "target") or "DNAT"
end


--
-- Rules
--

s = m:section(TypedSection, "rule", translate("Rules"))
s.addremove = true
s.anonymous = true
s.template = "cbi/tblsection"
s.extedit   = ds.build_url("admin", "network", "firewall", "rule", "%s")
s.defaults.target = "ACCEPT"

function s.create(self, section)
	local created = TypedSection.create(self, section)
	m.uci:save("firewall")
	luci.http.redirect(ds.build_url(
		"admin", "network", "firewall", "rule", created
	))
	return
end

name = s:option(DummyValue, "_name", translate("Name"))
function name.cfgvalue(self, s)
	return self.map:get(s, "_name") or "-"
end

if has_v2 then
	family = s:option(DummyValue, "family", translate("Family"))
	function family.cfgvalue(self, s)
		local f = self.map:get(s, "family")
		if f and f:match("4") then
			return translate("IPv4 only")
		elseif f and f:match("6") then
			return translate("IPv6 only")
		else
			return translate("IPv4 and IPv6")
		end
	end
end

proto = s:option(DummyValue, "proto", translate("Protocol"))
function proto.cfgvalue(self, s)
	local p = self.map:get(s, "proto")
	local t = self.map:get(s, "icmp_type")
	if p == "icmp" and t then
		return "ICMP (%s)" % t
	elseif p == "tcpudp" or not p then
		return "TCP+UDP"
	else
		return p:upper()
	end
end

src = s:option(DummyValue, "src", translate("Source"))
function src.cfgvalue(self, s)
	local rv = "%s:%s:%s" % {
		self.map:get(s, "src") or "*",
		self.map:get(s, "src_ip") or "0.0.0.0/0",
		self.map:get(s, "src_port") or "*"
	}

	local mac = self.map:get(s, "src_mac")
	if mac then
		rv = rv .. ", MAC " .. mac
	end

	return rv
end

dest = s:option(DummyValue, "dest", translate("Destination"))
function dest.cfgvalue(self, s)
	return "%s:%s:%s" % {
		self.map:get(s, "dest") or translate("Device"),
		self.map:get(s, "dest_ip") or "0.0.0.0/0",
		self.map:get(s, "dest_port") or "*"
	}
end


s:option(DummyValue, "target", translate("Action"))

return m
