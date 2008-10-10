--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--

require("luci.fs")
require("luci.ip")
require("luci.sys")
require("luci.model.uci")


local uci = luci.model.uci.cursor()

local m = Map("openvpn", translate("openvpn"))
local s = m:section( TypedSection, "openvpn", translate("openvpn_overview"), translate("openvpn_overview_desc") )
s.template = "cbi/tblsection"
s.template_addremove = "openvpn/cbi-select-input-add"
s.addremove = true
s.add_select_options = { }
s.extedit = luci.dispatcher.build_url(
	"admin", "services", "openvpn", "basic", "%s"
)

uci:load("openvpn_recipes")
uci:foreach( "openvpn_recipes", "openvpn_recipe",
	function(section)
		s.add_select_options[section['.name']] =
			section['_description'] or section['.name']
	end
)

function s.parse(self, section)
	local recipe = luci.http.formvalue(
		luci.cbi.CREATE_PREFIX .. self.config .. "." ..
		self.sectiontype .. ".select"
	)

	if recipe and not s.add_select_options[recipe] then
		self.invalid_cts = true
	else
		TypedSection.parse( self, section )
	end
end

function s.create(self, name)
	local recipe = luci.http.formvalue(
		luci.cbi.CREATE_PREFIX .. self.config .. "." ..
		self.sectiontype .. ".select"
	)

	uci:section(
		"openvpn", "openvpn", name,
		uci:get_all( "openvpn_recipes", recipe )
	)

	uci:delete("openvpn", name, "_role")
	uci:delete("openvpn", name, "_description")
	uci:save("openvpn")

	luci.http.redirect( self.extedit:format(name) )
end


s:option( Flag, "enable", translate("openvpn_enable") )

local active = s:option( DummyValue, "_active", translate("openvpn_active") )
function active.cfgvalue(self, section)
	if luci.fs.isfile("/var/run/openvpn_%s.pid" % section) then
		local pid = io.lines("/var/run/openvpn_%s.pid" % section)()
		if pid and #pid > 0 and tonumber(pid) ~= nil then
			return (luci.sys.process.signal(pid, 0))
				and translatef("openvpn_active_yes", pid)
				or  translate("openvpn_active_no")
		end
	end
	return translate("openvpn_active_no")
end

local port = s:option( DummyValue, "port", translate("openvpn_port") )
function port.cfgvalue(self, section)
	local val = AbstractValue.cfgvalue(self, section)
	return val or "1194"
end

local proto = s:option( DummyValue, "proto", translate("openvpn_proto") )
function proto.cfgvalue(self, section)
	local val = AbstractValue.cfgvalue(self, section)
	return val or "udp"
end


return m
