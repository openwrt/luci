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

m = Map("olsrd", translate("olsrd", "OLSR Daemon"))

s = m:section(TypedSection, "olsrd", translate("olsrd_general"))
s.dynamic = true
s.anonymous = true

debug = s:option(ListValue, "DebugLevel")
for i=0, 9 do
	debug:value(i)
end
debug.optional = true

ipv = s:option(ListValue, "IpVersion")
ipv:value("4", "IPv4")
ipv:value("6", "IPv6")

noint = s:option(Flag, "AllowNoInt")
noint.enabled = "yes"
noint.disabled = "no"
noint.optional = true

s:option(Value, "Pollrate").optional = true

tcr = s:option(ListValue, "TcRedundancy")
tcr:value("0", translate("olsrd_olsrd_tcredundancy_0"))
tcr:value("1", translate("olsrd_olsrd_tcredundancy_1"))
tcr:value("2", translate("olsrd_olsrd_tcredundancy_2"))
tcr.optional = true

s:option(Value, "MprCoverage").optional = true

lql = s:option(ListValue, "LinkQualityLevel")
lql:value("0", translate("disable"))
lql:value("1", translate("olsrd_olsrd_linkqualitylevel_1"))
lql:value("2", translate("olsrd_olsrd_linkqualitylevel_2"))
lql.optional = true

s:option(Value, "LinkQualityAging").optional = true

lqa = s:option(ListValue, "LinkQualityAlgorithm")
lqa.optional = true
lqa:value("etx_fpm", translate("olsrd_etx_fpm"))
lqa:value("etx_float", translate("olsrd_etx_float"))
lqa:value("etx_ff", translate("olsrd_etx_ff"))
lqa.optional = true

lqfish = s:option(Flag, "LinkQualityFishEye")
lqfish.optional = true

s:option(Value, "LinkQualityWinSize").optional = true

s:option(Value, "LinkQualityDijkstraLimit").optional = true

hyst = s:option(Flag, "UseHysteresis")
hyst.enabled = "yes"
hyst.disabled = "no"
hyst.optional = true

fib = s:option(ListValue, "FIBMetric")
fib.optional = true
fib:value("flat")
fib:value("correct")
fib:value("approx")
fib.optional = true

clrscr = s:option(Flag, "ClearScreen")
clrscr.enabled = "yes"
clrscr.disabled = "no"
clrscr.optional = true

willingness = s:option(ListValue, "Willingness")
for i=0,7 do
	willingness:value(i)
end
willingness.optional = true



i = m:section(TypedSection, "Interface", translate("interfaces"))
i.anonymous = true
i.addremove = true
i.dynamic = true

ign = i:option(Flag, "ignore", "Enable")
ign.enabled  = "0"
ign.disabled = "1"

network = i:option(ListValue, "interface", translate("network"))
luci.tools.webadmin.cbi_add_networks(network)

i:option(Value, "Ip4Broadcast").optional = true

ip6t = i:option(ListValue, "Ip6AddrType")
ip6t:value("", translate("cbi_select"))
ip6t:value("auto")
ip6t:value("site-local")
ip6t:value("unique-local")
ip6t:value("global")
ip6t.optional = true

i:option(Value, "HelloInterval").optional = true
i:option(Value, "HelloValidityTime").optional = true
i:option(Value, "TcInterval").optional = true
i:option(Value, "TcValidityTime").optional = true
i:option(Value, "MidInterval").optional = true
i:option(Value, "MidValidityTime").optional = true
i:option(Value, "HnaInterval").optional = true
i:option(Value, "HnaValidityTime").optional = true

adc = i:option(Flag, "AutoDetectChanges")
adc.enabled  = "yes"
adc.disabled = "no"
adc.optional = true

--[[
ipc = m:section(TypedSection, "IpcConnect")
ipc.anonymous = true

conns = ipc:option(Value, "MaxConnections")
conns.isInteger = true

nets  = ipc:option(Value, "Net")
nets.optional = true

hosts = ipc:option(Value, "Host")
hosts.optional = true
]]

return m
