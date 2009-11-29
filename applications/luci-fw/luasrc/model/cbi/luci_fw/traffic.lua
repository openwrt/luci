--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>
Copyright 2008 Jo-Philipp Wich <xm@leipzig.freifunk.net>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--

m = Map("firewall", translate("Traffic Control"))
s = m:section(TypedSection, "forwarding", translate("Zone-to-Zone traffic"), translate("Here you can specify which network traffic is allowed to flow between network zones. Only new connections will be matched. Packets belonging to already open connections are automatically allowed to pass the firewall. If you experience occasional connection problems try enabling MSS Clamping otherwise disable it for performance reasons."))
s.template  = "cbi/tblsection"
s.addremove = true
s.anonymous = true

iface = s:option(ListValue, "src", translate("Source"))
oface = s:option(ListValue, "dest", translate("Destination"))

luci.model.uci.cursor():foreach("firewall", "zone",
	function (section)
			iface:value(section.name)
			oface:value(section.name)
	end)



s = m:section(TypedSection, "rule")
s.addremove = true
s.anonymous = true
s.template = "cbi/tblsection"
s.extedit   = luci.dispatcher.build_url("admin", "network", "firewall", "rule", "%s")
s.defaults.target = "ACCEPT"

local created = nil

function s.create(self, section)
	created = TypedSection.create(self, section)
end

function s.parse(self, ...)
	TypedSection.parse(self, ...)
	if created then
		m.uci:save("firewall")
		luci.http.redirect(luci.dispatcher.build_url(
			"admin", "network", "firewall", "rule", created
		))
	end
end

s:option(DummyValue, "_name", translate("Name"))
s:option(DummyValue, "proto", translate("Protocol"))

src = s:option(DummyValue, "src", translate("Source"))
function src.cfgvalue(self, s)
	return "%s:%s:%s" % {
		self.map:get(s, "src") or "*",
		self.map:get(s, "src_ip") or "0.0.0.0/0",
		self.map:get(s, "src_port") or "*"
	} 
end

dest = s:option(DummyValue, "dest", translate("Destination"))
function dest.cfgvalue(self, s)
	return "%s:%s:%s" % {
		self.map:get(s, "dest") or translate("Device"),
		self.map:get(s, "dest_ip") or "0.0.0.0/0",
		self.map:get(s, "dest_port") or "*"
	} 
end


s:option(DummyValue, "target")


return m