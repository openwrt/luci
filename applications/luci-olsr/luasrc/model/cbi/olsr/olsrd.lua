--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--
require("luci.fs")

m = Map("olsr", "OLSR")

s = m:section(NamedSection, "general", "olsr")

debug = s:option(ListValue, "DebugLevel")
for i=0, 9 do
	debug:value(i)
end

ipv = s:option(ListValue, "IpVersion")
ipv:value("4", "IPv4")
ipv:value("6", "IPv6")

noint = s:option(Flag, "AllowNoInt")
noint.enabled = "yes"
noint.disabled = "no"

s:option(Value, "Pollrate")

tcr = s:option(ListValue, "TcRedundancy")
tcr:value("0", translate("olsr_general_tcredundancy_0"))
tcr:value("1", translate("olsr_general_tcredundancy_1"))
tcr:value("2", translate("olsr_general_tcredundancy_2"))

s:option(Value, "MprCoverage")

lql = s:option(ListValue, "LinkQualityLevel")
lql:value("0", translate("disable"))
lql:value("1", translate("olsr_general_linkqualitylevel_1"))
lql:value("2", translate("olsr_general_linkqualitylevel_2"))

lqfish = s:option(Flag, "LinkQualityFishEye")

s:option(Value, "LinkQualityWinSize")

s:option(Value, "LinkQualityDijkstraLimit")

hyst = s:option(Flag, "UseHysteresis")
hyst.enabled = "yes"
hyst.disabled = "no"


i = m:section(TypedSection, "Interface", translate("interfaces"))
i.anonymous = true
i.addremove = true
i.dynamic = true

network = i:option(ListValue, "Interface", translate("network"))
network:value("")
luci.model.uci.foreach("network", "interface",
	function (section)
		if section[".name"] ~= "loopback" then
			network:value(section[".name"])
		end
	end)

i:option(Value, "HelloInterval")
i:option(Value, "HelloValidityTime")
i:option(Value, "TcInterval")
i:option(Value, "TcValidityTime")
i:option(Value, "MidInterval")
i:option(Value, "MidValidityTime")
i:option(Value, "HnaInterval")
i:option(Value, "HnaValidityTime")


p = m:section(TypedSection, "LoadPlugin")
p.addremove = true
p.dynamic = true

lib = p:option(ListValue, "Library", translate("library"))
lib:value("")
for k, v in pairs(luci.fs.dir("/usr/lib")) do
	if v:sub(1, 6) == "olsrd_" then
		lib:value(v)
	end
end


for i, sect in ipairs({ "Hna4", "Hna6" }) do
	hna = m:section(TypedSection, sect)
	hna.addremove = true
	hna.anonymous = true

	net = hna:option(Value, "NetAddr")
	msk = hna:option(Value, "Prefix")
end


ipc = m:section(NamedSection, "IpcConnect")
conns = ipc:option(Value, "MaxConnections")
conns.isInteger = true

nets  = ipc:option(Value, "Net")
nets.optional = true

hosts = ipc:option(Value, "Host")
hosts.optional = true


return m
