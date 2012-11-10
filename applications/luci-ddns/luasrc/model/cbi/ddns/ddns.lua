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

local is_mini = (luci.dispatcher.context.path[1] == "mini")


m = Map("ddns", translate("Dynamic DNS"),
	translate("Dynamic DNS allows that your router can be reached with " ..
		"a fixed hostname while having a dynamically changing " ..
		"IP address."))

s = m:section(TypedSection, "service", "")
s.addremove = true
s.anonymous = false

s:option(Flag, "enabled", translate("Enable"))

interface = s:option(ListValue, "interface", translate("Event interface"), translate("On which interface up should start the ddns script process."))
luci.tools.webadmin.cbi_add_networks(interface)
interface.default = "wan"

svc = s:option(ListValue, "service_name", translate("Service"))
svc.rmempty = false

local services = { }
local fd = io.open("/usr/lib/ddns/services", "r")
if fd then
	local ln
	repeat
		ln = fd:read("*l")
		local s = ln and ln:match('^%s*"([^"]+)"')
		if s then services[#services+1] = s end
	until not ln
	fd:close()
end

local v
for _, v in luci.util.vspairs(services) do
	svc:value(v)
end

function svc.cfgvalue(...)
	local v = Value.cfgvalue(...)
	if not v or #v == 0 then
		return "-"
	else
		return v
	end
end

function svc.write(self, section, value)
	if value == "-" then
		m.uci:delete("ddns", section, self.option)
	else
		Value.write(self, section, value)
	end
end

svc:value("-", "-- "..translate("custom").." --")

url = s:option(Value, "update_url", translate("Custom update-URL"))
url:depends("service_name", "-")
url.rmempty = true

s:option(Value, "domain", translate("Hostname")).rmempty = true
s:option(Value, "username", translate("Username")).rmempty = true
pw = s:option(Value, "password", translate("Password"))
pw.rmempty = true
pw.password = true


if is_mini then
	s.defaults.ip_source = "network"
	s.defaults.ip_network = "wan"
else

	src = s:option(ListValue, "ip_source",
		translate("Source of IP address"))
	src:value("network", translate("network"))
	src:value("interface", translate("interface"))
	src:value("web", translate("URL"))

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

	web = s:option(Value, "ip_url", translate("URL"))
	web:depends("ip_source", "web")
	web.rmempty = true
end


ci = s:option(Value, "check_interval", translate("Check for changed IP every"))
ci.datatype = "and(uinteger,min(1))"
ci.default = 10

unit = s:option(ListValue, "check_unit", translate("Check-time unit"))
unit.default = "minutes"
unit:value("minutes", translate("min"))
unit:value("hours", translate("h"))

fi = s:option(Value, "force_interval", translate("Force update every"))
fi.datatype = "and(uinteger,min(1))"
fi.default = 72

unit = s:option(ListValue, "force_unit", translate("Force-time unit"))
unit.default = "hours"
unit:value("minutes", translate("min"))
unit:value("hours", translate("h"))


return m
