--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--

local fs  = require "nixio.fs"
local sys = require "luci.sys"
local uci = require "luci.model.uci".cursor()

local m = Map("openvpn", translate("OpenVPN"))
local s = m:section( TypedSection, "openvpn", translate("OpenVPN instances"), translate("Below is a list of configured OpenVPN instances and their current state") )
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

	if name and not name:match("[^a-zA-Z0-9_]") then
		uci:section(
			"openvpn", "openvpn", name,
			uci:get_all( "openvpn_recipes", recipe )
		)

		uci:delete("openvpn", name, "_role")
		uci:delete("openvpn", name, "_description")
		uci:save("openvpn")

		luci.http.redirect( self.extedit:format(name) )
	else
		self.invalid_cts = true
	end
end


s:option( Flag, "enabled", translate("Enabled") )

local active = s:option( DummyValue, "_active", translate("Started") )
function active.cfgvalue(self, section)
	local pid = fs.readfile("/var/run/openvpn-%s.pid" % section)
	if pid and #pid > 0 and tonumber(pid) ~= nil then
		return (sys.process.signal(pid, 0))
			and translatef("yes (%i)", pid)
			or  translate("no")
	end
	return translate("no")
end

local updown = s:option( Button, "_updown", translate("Start/Stop") )
updown._state = false
function updown.cbid(self, section)
	local pid = fs.readfile("/var/run/openvpn-%s.pid" % section)
	self._state = pid and #pid > 0 and sys.process.signal(pid, 0)
	self.option = self._state and "stop" or "start"
	return AbstractValue.cbid(self, section)
end
function updown.cfgvalue(self, section)
	self.title = self._state and "stop" or "start"
	self.inputstyle = self._state and "reset" or "reload"
end
function updown.write(self, section, value)
	if self.option == "stop" then
		luci.sys.call("/etc/init.d/openvpn down %s" % section)
	else
		luci.sys.call("/etc/init.d/openvpn up %s" % section)
	end
end

local port = s:option( DummyValue, "port", translate("Port") )
function port.cfgvalue(self, section)
	local val = AbstractValue.cfgvalue(self, section)
	return val or "1194"
end

local proto = s:option( DummyValue, "proto", translate("Protocol") )
function proto.cfgvalue(self, section)
	local val = AbstractValue.cfgvalue(self, section)
	return val or "udp"
end


return m
