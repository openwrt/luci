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
require("luci.tools.webadmin")
m = Map("ddns", translate("Dynamic DNS"), translate("Dynamic DNS allows that your router can be reached with a fixed hostname while having a dynamically changing IP-Address."))

s = m:section(TypedSection, "service", "")
s.addremove = true

s:option(Flag, "enabled", translate("enable"))

svc = s:option(ListValue, "service_name", translate("Service"))
svc.rmempty = true
svc:value("")
svc:value("dyndns.org")
svc:value("changeip.com")
svc:value("zoneedit.com")
svc:value("no-ip.com")
svc:value("freedns.afraid.org")

s:option(Value, "domain", translate("Hostname")).rmempty = true
s:option(Value, "username", translate("Username")).rmempty = true
pw = s:option(Value, "password", translate("Password"))
pw.rmempty = true
pw.password = true

src = s:option(ListValue, "ip_source", translate("Source of IP-Address"))
src:value("network", translate("Network"))
src:value("interface", translate("Interface"))
src:value("web", "URL")

iface = s:option(ListValue, "ip_network", translate("Network"))
iface:depends("ip_source", "network")
iface.rmempty = true
luci.tools.webadmin.cbi_add_networks(iface)

iface = s:option(ListValue, "ip_interface", translate("Interface"))
iface:depends("ip_source", "interface")
iface.rmempty = true
for k, v in pairs(luci.sys.net.devices()) do
	iface:value(v)
end

web = s:option(Value, "ip_url", "URL")
web:depends("ip_source", "web")
web.rmempty = true

s:option(Value, "update_url", translate("Custom Update-URL")).optional = true

s:option(Value, "check_interval", translate("Check for changed IP every")).default = 10
unit = s:option(ListValue, "check_unit", translate("Check-Time unit"))
unit.default = "minutes"
unit:value("minutes", "min")
unit:value("hours", "h")

s:option(Value, "force_interval", translate("Force update every")).default = 72
unit = s:option(ListValue, "force_unit", translate("Force-Time unit"))
unit.default = "hours"
unit:value("minutes", "min")
unit:value("hours", "h")


return m
