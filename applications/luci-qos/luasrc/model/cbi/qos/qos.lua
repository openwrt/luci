--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--
m = Map("qos", "Quality of Service", [[Mit Hilfe von QoS kann einzelnen Rechnern oder Netzwerkdiensten
eine höhere oder niedrigere Priorität zugewiesen werden.]])

s = m:section(TypedSection, "interface", "Schnittstellen")
s.addremove = true

s:option(Flag, "enabled", "aktiviert")

c = s:option(ListValue, "classgroup", "Klassifizierung")
c:value("Default", "standard")
c.default = "Default"

s:option(Flag, "overhead", "Overheadberechnung")

s:option(Value, "download", "Downlink", "kb/s")

s:option(Value, "upload", "Uplink", "kb/s")

s = m:section(TypedSection, "classify", "Klassifizierung")

s.anonymous = true
s.addremove = true

t = s:option(ListValue, "target", "Klasse")
t:value("Priority")
t:value("Express")
t:value("Normal")
t:value("Bulk")
t.default = "Normal"

s:option(Value, "srchost", "Quelladresse", "Quellhost / Quellnetz").optional = true
s:option(Value, "dsthost", "Zieladresse", "Zielhost / Zielnetz").optional = true
s:option(Value, "layer7", "Layer 7").optional = true

p2p = s:option(ListValue, "ipp2p", "P2P")
p2p:value("")
p2p:value("all", "Alle")
p2p:value("bit", "Bittorrent")
p2p:value("dc", "DirectConnect")
p2p:value("edk", "eDonkey")
p2p:value("gnu", "Gnutella")
p2p:value("kazaa", "Kazaa")
p2p.optional = true

p = s:option(ListValue, "proto", "Protokoll")
p:value("")
p:value("tcp", "TCP")
p:value("udp", "UDP")
p:value("icmp", "ICMP")
p.optional = true

s:option(Value, "ports", "Port").optional = true
s:option(Value, "portrange", "Portbereich").optional = true

return m