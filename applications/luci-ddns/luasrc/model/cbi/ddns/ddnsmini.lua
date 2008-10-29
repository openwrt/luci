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
m = Map("ddns", translate("ddns"), translate("ddns_desc"))

s = m:section(TypedSection, "service", "")
s.addremove = true

s:option(Flag, "enabled", translate("enable"))

svc = s:option(ListValue, "service_name", translate("service"))
svc.rmempty = true
svc:value("dyndns.org")
svc:value("changeip.com")
svc:value("zoneedit.com")
svc:value("no-ip.com")
svc:value("freedns.afraid.org")

s:option(Value, "domain", translate("hostname")).rmempty = true
s:option(Value, "username", translate("username")).rmempty = true
pw = s:option(Value, "password", translate("password"))
pw.rmempty = true
pw.password = true

s.defaults.ip_source = "network"
s.defaults.ip_network = "wan"

s:option(Value, "check_interval").default = 10
unit = s:option(ListValue, "check_unit")
unit.default = "minutes"
unit:value("minutes", "min")
unit:value("hours", "h")

s:option(Value, "force_interval").default = 72
unit = s:option(ListValue, "force_unit")
unit.default = "hours"
unit:value("minutes", "min")
unit:value("hours", "h")


return m
