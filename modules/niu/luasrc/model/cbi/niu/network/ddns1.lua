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
local nxo = require "nixio"

m = Map("ddns", translate("Dynamic DNS"), translate("Dynamic DNS allows that this device can be reached with a fixed hostname while having a dynamically changing IP-Address."))

s = m:section(TypedSection, "service", "")
s:depends("enabled", "1")
s.addremove = true

s.defaults.enabled = "1"
s.defaults.ip_network = "wan"
s.defaults.ip_url = "http://checkip.dyndns.org http://www.whatismyip.com/automation/n09230945.asp"


s:tab("general", translate("General Settings"))

svc = s:taboption("general", ListValue, "service_name", translate("Service"))
svc:value("dyndns.org")
svc:value("no-ip.com")
svc:value("changeip.com")
svc:value("zoneedit.com")


s:taboption("general", Value, "username", translate("Username"))
pw = s:taboption("general", Value, "password", translate("Password"))
pw.password = true
local dom = s:taboption("general", Value, "domain", translate("Hostname"))

local current = s:taboption("general", DummyValue, "_current", "Current IP-Address")

function current.render(self, section, ...)
	if dom:cfgvalue(section) then
		return DummyValue.render(self, section, ...)
	end
end

function current.value(self, section)
	local dns = nxo.getaddrinfo(dom:cfgvalue(section))
	if dns then
		for _, v in ipairs(dns) do
			if v.family == "inet" then
				return v.address
			end
		end
	end
	return ""
end

s:tab("expert", translate("Expert Settings"))

local src = s:taboption("expert", ListValue, "ip_source", "External IP Determination")
src.default = "web"
src:value("web", "CheckIP / WhatIsMyIP webservice")
src:value("network", "External Address as seen locally")



return m
