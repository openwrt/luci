-- Copyright 2008 Steven Barth <steven@midlink.org>
-- Licensed to the public under the Apache License 2.0.

local ds = require "luci.dispatcher"
local fw = require "luci.model.firewall"
local fs = require "nixio.fs"

local m, s, o, p, i, v

m = Map("firewall",
	translate("Firewall - Zone Settings"),
	translate("The firewall creates zones over your network interfaces to control network traffic flow."))

fw.init(m.uci)

s = m:section(TypedSection, "defaults", translate("General Settings"))
s.anonymous = true
s.addremove = false

s:option(Flag, "syn_flood", translate("Enable SYN-flood protection"))

o = s:option(Flag, "drop_invalid", translate("Drop invalid packets"))

p = {
	s:option(ListValue, "input", translate("Input")),
	s:option(ListValue, "output", translate("Output")),
	s:option(ListValue, "forward", translate("Forward"))
}

for i, v in ipairs(p) do
	v:value("REJECT", translate("reject"))
	v:value("DROP", translate("drop"))
	v:value("ACCEPT", translate("accept"))
end

-- Netfilter flow offload support

local offload = fs.access("/sys/module/xt_FLOWOFFLOAD/refcnt")

if offload then
	s:option(DummyValue, "offload_advice",
		translate("Routing/NAT Offloading"),
		translate("Experimental feature. Not fully compatible with QoS/SQM."))

	o = s:option(Flag, "flow_offloading",
		translate("Software flow offloading"),
		translate("Software based offloading for routing/NAT"))
	o.optional = true

	o = s:option(Flag, "flow_offloading_hw",
		translate("Hardware flow offloading"),
		translate("Requires hardware NAT support. Implemented at least for mt7621"))
	o.optional = true
	o:depends( "flow_offloading", 1)
end

-- Firewall zones

s = m:section(TypedSection, "zone", translate("Zones"))
s.template = "cbi/tblsection"
s.anonymous = true
s.addremove = true
s.extedit   = ds.build_url("admin", "network", "firewall", "zones", "%s")

function s.sectiontitle(self, sid)
	local z = fw:get_zone(sid)
	return z:name()
end

function s.create(self)
	local z = fw:new_zone()
	if z then
		luci.http.redirect(
			ds.build_url("admin", "network", "firewall", "zones", z.sid)
		)
	end
end

function s.remove(self, section)
	return fw:del_zone(section)
end

o = s:option(DummyValue, "_info", translate("Zone ⇒ Forwardings"))
o.template = "cbi/firewall_zoneforwards"
o.cfgvalue = function(self, section)
	return self.map:get(section, "name")
end

p = {
	s:option(ListValue, "input", translate("Input")),
	s:option(ListValue, "output", translate("Output")),
	s:option(ListValue, "forward", translate("Forward"))
}

for i, v in ipairs(p) do
	v:value("REJECT", translate("reject"))
	v:value("DROP", translate("drop"))
	v:value("ACCEPT", translate("accept"))
end

s:option(Flag, "masq", translate("Masquerading"))
s:option(Flag, "mtu_fix", translate("MSS clamping"))

return m
