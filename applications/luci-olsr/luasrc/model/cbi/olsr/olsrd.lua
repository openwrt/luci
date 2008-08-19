--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--
require("luci.tools.webadmin")
require("luci.fs")

m = Map("olsr", "OLSR")

s = m:section(NamedSection, "general", "olsr")
s.dynamic = true

debug = s:option(ListValue, "DebugLevel")
for i=0, 9 do
	debug:value(i)
end

ipv = s:option(ListValue, "IpVersion")
ipv:value("4", "IPv4")
ipv:value("6", "IPv6")


i = m:section(TypedSection, "Interface", translate("interfaces"))
i.anonymous = true
i.addremove = true
i.dynamic = true

network = i:option(ListValue, "Interface", translate("network"))
luci.tools.webadmin.cbi_add_networks(network)

i:option(Value, "Ip4Broadcast")
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
	hna.template  = "cbi/tblsection"

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
