--[[
LuCI - Lua Configuration Interface

Copyright 2009 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--

local niulib = require "luci.niulib"

m = Map("network", "Configure Internet Connection")
s = m:section(NamedSection, "wan", "interface", "Internet Connection Device")
s.anonymous = true
s.addremove = false

s:tab("general", translate("General Settings"))
s:tab("expert", translate("Expert Settings"))

l = s:taboption("general", ListValue, "_wandev", "Internet Connection via")

for _, ifc in ipairs(niulib.eth_get_available("wan")) do
	l:value("ethernet:%s" % ifc, "Cable / DSL / Ethernet-Adapter (%s)" % ifc)
end

for _, wifi in ipairs(niulib.wifi_get_available("client")) do
	l:value("wlan:%s" % wifi, "WLAN-Adapter (%s)" % wifi)
end

for _, ifc in ipairs(niulib.eth_get_bridged("lan")) do
	l:value("ethernet:!%s" % ifc, "Used Ethernet-Adapter (%s)" % ifc, {_showused = "1"})
end

l:value("none", "No Internet Connection")

v = s:taboption("expert", ListValue, "_showused", translate("Show ethernet adapters in use"))
v:value("", translate("never"))
v:value("1", translate("from LAN-bridge, unbridge on-demand"))



return m
