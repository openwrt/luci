--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--
m = Map("qos")

s = m:section(TypedSection, "interface", translate("interfaces"))
s.addremove = true

s:option(Flag, "enabled", translate("enable"))

c = s:option(ListValue, "classgroup")
c:value("Default", "standard")
c.default = "Default"

s:option(Flag, "overhead")

s:option(Value, "download", nil, "kb/s")

s:option(Value, "upload", nil, "kb/s")

s = m:section(TypedSection, "classify")

s.anonymous = true
s.addremove = true

t = s:option(ListValue, "target")
t:value("Priority")
t:value("Express")
t:value("Normal")
t:value("Bulk")
t.default = "Normal"

s:option(Value, "srchost").optional = true
s:option(Value, "dsthost").optional = true
s:option(Value, "layer7", "Layer 7").optional = true

p2p = s:option(ListValue, "ipp2p", "P2P")
p2p:value("")
p2p:value("all", translate("all"))
p2p:value("bit", "BitTorrent")
p2p:value("dc", "DirectConnect")
p2p:value("edk", "eDonkey")
p2p:value("gnu", "Gnutella")
p2p:value("kazaa", "Kazaa")
p2p.optional = true

p = s:option(ListValue, "proto", translate("protocol"))
p:value("")
p:value("tcp", "TCP")
p:value("udp", "UDP")
p:value("icmp", "ICMP")
p.optional = true

s:option(Value, "ports", translate("port")).optional = true
s:option(Value, "portrange").optional = true

return m