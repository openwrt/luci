--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--
require("luci.sys")
m = Map("luci_fw", translate("fw_portfw"), translate("fw_portfw1"))


s = m:section(TypedSection, "portfw", "")
s:depends("iface", "wan")
s.defaults.iface = "wan"

s.template  = "cbi/tblsection"
s.addremove = true
s.anonymous = true

name = s:option(Value, "_name", translate("name") .. translate("cbi_optional"))

proto = s:option(ListValue, "proto", translate("protocol"))
proto:value("tcp", "TCP")
proto:value("udp", "UDP")
proto:value("tcpudp", "TCP + UDP")

dport = s:option(Value, "dport")

to = s:option(Value, "to")

return m
