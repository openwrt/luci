--[[
LuCI - Lua Configuration Interface

Copyright 2011 Manuel Munz <freifunk at somakoma dot de>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0
]]--

m = Map("luci_statistics",
	translate("OLSRd Plugin Configuration"),
	translate("The OLSRd plugin reads information about meshed networks from the txtinfo plugin of OLSRd."))

s = m:section(NamedSection, "collectd_olsrd", "luci_statistics" )

enable = s:option(Flag, "enable", translate("Enable this plugin"))
enable.default = 0

host = s:option(Value, "Host", translate("Host"), translate("IP or hostname where to get the txtinfo output from"))
host.placeholder = "127.0.0.1"
host.datatype = "host"
host.rmempty = true

port = s:option(Value, "Port", translate("Port"))
port.placeholder = "2006"
port.datatype = "range(0,65535)"
port.rmempty = true
port.cast = "string"

cl = s:option(ListValue, "CollectLinks", translate("CollectLinks"),
	translate("Specifies what information to collect about links."))
cl:value("No")
cl:value("Summary")
cl:value("Detail")
cl.default = "Detail"

cr = s:option(ListValue, "CollectRoutes", translate("CollectRoutes"),
        translate("Specifies what information to collect about routes."))
cr:value("No")
cr:value("Summary")
cr:value("Detail")
cr.default = "Summary"

ct = s:option(ListValue, "CollectTopology", translate("CollectTopology"),
        translate("Specifies what information to collect about the global topology."))
ct:value("No")
ct:value("Summary")
ct:value("Detail")
ct.default = "Summary"

return m
