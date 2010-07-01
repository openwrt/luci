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

m = Map("olsrd", translate("OLSR Daemon"))

s = m:section(TypedSection, "olsrd", translate("General settings"))
s.dynamic = true
s.anonymous = true

debug = s:option(ListValue, "DebugLevel", translate("Debugmode"))
for i=0, 9 do
	debug:value(i)
end
debug.optional = true

ipv = s:option(ListValue, "IpVersion", translate("Internet protocol"))
ipv:value("4", "IPv4")
ipv:value("6", "IPv6")

noint = s:option(Flag, "AllowNoInt", translate("Start without network"))
noint.enabled = "yes"
noint.disabled = "no"
noint.optional = true

s:option(Value, "Pollrate", translate("Pollrate")).optional = true

tcr = s:option(ListValue, "TcRedundancy", translate("TC redundancy"))
tcr:value("0", translate("MPR selectors"))
tcr:value("1", translate("MPR selectors and MPR"))
tcr:value("2", translate("all neighbours"))
tcr.optional = true

s:option(Value, "MprCoverage", translate("MPR coverage")).optional = true

lql = s:option(ListValue, "LinkQualityLevel", translate("LQ level"))
lql:value("0", translate("disable"))
lql:value("1", translate("MPR selection"))
lql:value("2", translate("MPR selection and routing"))
lql.optional = true

s:option(Value, "LinkQualityAging", translate("LQ aging")).optional = true

lqa = s:option(ListValue, "LinkQualityAlgorithm", translate("LQ algorithm"))
lqa.optional = true
lqa:value("etx_fpm", translate("fixed point math"))
lqa:value("etx_float", translate("floating point"))
lqa:value("etx_ff", translate("Freifunk"))
lqa.optional = true

lqfish = s:option(Flag, "LinkQualityFishEye", translate("LQ fisheye"))
lqfish.optional = true

s:option(Value, "LinkQualityWinSize", translate("LQ window size")).optional = true

s:option(Value, "LinkQualityDijkstraLimit", translate("LQ Dijkstra limit")).optional = true

hyst = s:option(Flag, "UseHysteresis", translate("Use hysteresis"))
hyst.enabled = "yes"
hyst.disabled = "no"
hyst.optional = true

fib = s:option(ListValue, "FIBMetric", translate("FIB metric"))
fib.optional = true
fib:value("flat")
fib:value("correct")
fib:value("approx")
fib.optional = true

clrscr = s:option(Flag, "ClearScreen", translate ("Clear screen"))
clrscr.enabled = "yes"
clrscr.disabled = "no"
clrscr.optional = true

willingness = s:option(ListValue, "Willingness", translate("Willingness"))
for i=0,7 do
	willingness:value(i)
end
willingness.optional = true

natthr = s:option(Value, "NatThreshold", translate("NAT threshold"))
natthr.optional = true


i = m:section(TypedSection, "Interface", translate("Interfaces"))
i.anonymous = true
i.addremove = true
i.dynamic = true

ign = i:option(Flag, "ignore", translate("Enable"))
ign.enabled  = "0"
ign.disabled = "1"
ign.rmempty = false
function ign.cfgvalue(self, section)
	return Flag.cfgvalue(self, section) or "0"
end

network = i:option(ListValue, "interface", translate("Network"))
luci.tools.webadmin.cbi_add_networks(network)

i:option(Value, "Ip4Broadcast", translate("IPv4 broadcast")).optional = true

ip6t = i:option(ListValue, "Ip6AddrType", translate("IPv6 address type"))
ip6t:value("", translate("-- Please choose --"))
ip6t:value("auto")
ip6t:value("site-local")
ip6t:value("unique-local")
ip6t:value("global")
ip6t.optional = true

i:option(Value, "HelloInterval", translate("Hello interval")).optional = true
i:option(Value, "HelloValidityTime", translate("Hello validity time")).optional = true
i:option(Value, "TcInterval", translate("TC interval")).optional = true
i:option(Value, "TcValidityTime", translate("TC validity time")).optional = true
i:option(Value, "MidInterval", translate("MID interval")).optional = true
i:option(Value, "MidValidityTime", translate("MID validity time")).optional = true
i:option(Value, "HnaInterval", translate("HNA interval")).optional = true
i:option(Value, "HnaValidityTime", translate("HNA validity time")).optional = true

adc = i:option(Flag, "AutoDetectChanges", translate("Autodetect changes"))
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
