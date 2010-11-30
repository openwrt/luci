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

m = Map("olsrd", translate("OLSR Daemon"),
        translate("The OLSR daemon is an implementation of the Optimized Link State Routing protocol. "..
	"As such it allows mesh routing for any network equipment. "..
	"It runs on any wifi card that supports ad-hoc mode and of course on any ethernet device. "..
	"Visit <a href='http://www.olsr.org'>olsrd.org</a> for help and documentation."))

s = m:section(TypedSection, "olsrd", translate("General settings"))
s.dynamic = true
s.anonymous = true

ipv = s:option(ListValue, "IpVersion", translate("Internet protocol"),
	translate("IP-version to use. If 6and4 is selected then one olsrd instance is started for each protocol."))
ipv:value("4", "IPv4")
ipv:value("6", "IPv6")
ipv:value("6and4", "6and4")

debug = s:option(ListValue, "DebugLevel", translate("Debugmode"), translate("Debug level to use. This should usually stay at 0."))
for i=0, 9 do
	debug:value(i)
end
debug.optional = true

clrscr = s:option(Flag, "ClearScreen", translate ("Clear screen"),
	translate("Clear the screen each time the internal state changes. Default is \"yes\"."))
clrscr.default = "yes"
clrscr.enabled = "yes"
clrscr.disabled = "no"
clrscr.optional = true

noint = s:option(Flag, "AllowNoInt", translate("Start without network"),
	translate("If this is set to \"yes\" then olsrd also starts when no network devices are found."))
noint.default = "yes"
noint.enabled = "yes"
noint.disabled = "no"
noint.optional = true

s:option(Value, "Pollrate", translate("Pollrate"),
	translate("Polling rate for OLSR sockets in seconds. Default is 0.05.")).optional = true

s:option(Value, "NicChgsPollInt", translate("Nic changes poll interval"),
	translate("Interval to poll network interfaces for configuration changes (in seconds). Default is \"2.5\".")).optional = true

s:option(Value, "TosValue", translate("TOS value"),
	translate("Type of service value for the IP header of control traffic. Default is \"16\".")).optional = true

fib = s:option(ListValue, "FIBMetric", translate("FIB metric"),
	translate ("FIBMetric controls the metric value of the host-routes OLSRd sets. "..
	"\"flat\" means that the metric value is always 2. This is the preferred value "..
	"because it helps the linux kernel routing to clean up older routes. "..
	"\"correct\" uses the hopcount as the metric value. "..
	"\"approx\" use the hopcount as the metric value too, but does only update the hopcount if the nexthop changes too. "..
	"Default is \"flat\"."))
fib.optional = true
fib:value("flat")
fib:value("correct")
fib:value("approx")
fib.optional = true

lql = s:option(ListValue, "LinkQualityLevel", translate("LQ level"),
	translate("Link quality level switch between hopcount and cost-based (mostly ETX) routing.<br />"..
	"<b>0</b> = do not use link quality<br />"..
	"<b>2</b> = use link quality for MPR selection and routing<br />"..
	"Default is \"2\""))
lql:value("2")
lql:value("0")
lql.optional = true

lqage = s:option(Value, "LinkQualityAging", translate("LQ aging"),
	translate("Link quality aging factor (only for lq level 2). Tuning parameter for etx_float and etx_fpm, smaller values "..
	"mean slower changes of ETX value. (allowed values are between 0.01 and 1.0)"))
lqage.optional = true
lqage:depends("LinkQualityLevel", "2")

lqa = s:option(ListValue, "LinkQualityAlgorithm", translate("LQ algorithm"),
	translate("Link quality algorithm (only for lq level 2).<br />"..
	"<b>etx_float</b>: floating point ETX with exponential aging<br />"..
	"<b>etx_fpm</b>  : same as ext_float, but with integer arithmetic<br />"..
	"<b>etx_ff</b>   : ETX freifunk, an etx variant which use all OLSR traffic (instead of only hellos) for ETX calculation<br />"..
	"<b>etx_ffeth</b>: incompatible variant of etx_ff that allows ethernet links with ETX 0.1.<br />"..
	"Defaults to \"etx_ff\""))
lqa.optional = true
lqa:value("etx_ff") 
lqa:value("etx_fpm")
lqa:value("etx_float")
lqa:value("etx_ffeth")
lqa:depends("LinkQualityLevel", "2")
lqa.optional = true

lqfish = s:option(Flag, "LinkQualityFishEye", translate("LQ fisheye"),
	translate("Fisheye mechanism for TCs (checked means on). Default is \"on\""))
lqfish.default = "1"
lqfish.optional = true

hyst = s:option(Flag, "UseHysteresis", translate("Use hysteresis"),
	translate("Hysteresis for link sensing (only for hopcount metric). Hysteresis adds more robustness to the link sensing "..
	"but delays neighbor registration. Defaults is \"yes\""))
hyst.default = "yes"
hyst.enabled = "yes"
hyst.disabled = "no"
hyst:depends("LinkQualityLevel", "0")
hyst.optional = true

port = s:option(Value, "OlsrPort", translate("Port"),
        translate("The port OLSR uses. This should usually stay at the IANA assigned port 698. It can have a value between 1 and 65535."))
port.optional = true
port.default = "698"
port.rmempty = true

mainip = s:option(Value, "MainIp", translate("Main IP"),
        translate("Sets the main IP (originator ip) of the router. This IP will NEVER change during the uptime of olsrd. "..
	"Default is 0.0.0.0, which triggers usage of the IP of the first interface."))
mainip.optional = true
mainip.rmempty = true

willingness = s:option(ListValue, "Willingness", translate("Willingness"),
		translate("The fixed willingness to use. If not set willingness will be calculated dynamically based on battery/power status. Default is \"3\"."))
for i=0,7 do
	willingness:value(i)
end
willingness.optional = true

natthr = s:option(Value, "NatThreshold", translate("NAT threshold"),
	translate("If the route to the current gateway is to be changed, the ETX value of this gateway is ".. 
	"multiplied with this value before it is compared to the new one. "..
	"The parameter can be a value between 0.1 and 1.0, but should be close to 1.0 if changed.<br />"..
	"<b>WARNING:</b> This parameter should not be used together with the etx_ffeth metric!<br />"..
	"Defaults to \"1.0\"."))
for i=1,0.1,-0.1 do
        natthr:value(i)
end
natthr:depends("LinkQualityAlgorithm", "etx_ff")
natthr:depends("LinkQualityAlgorithm", "etx_float")
natthr:depends("LinkQualityAlgorithm", "etx_fpm")
natthr.default = 1
natthr.optional = true

i = m:section(TypedSection, "Interface", translate("Interfaces"))
i.anonymous = true
i.addremove = true
i.dynamic = true

ign = i:option(Flag, "ignore", translate("Enable"),
	translate("Enable this interface."))
ign.enabled  = "0"
ign.disabled = "1"
ign.rmempty = false
function ign.cfgvalue(self, section)
	return Flag.cfgvalue(self, section) or "0"
end

network = i:option(ListValue, "interface", translate("Network"),
	translate("The interface where OLSRd should run. If \"Default\" is selected then the settings made "..
	"here are used for all other interfaces unless overwritten."))
luci.tools.webadmin.cbi_add_networks(network)
network:value("Default")

mode = i:option(ListValue, "Mode", translate("Mode"),
	translate("Interface Mode is used to prevent unnecessary packet forwarding on switched ethernet interfaces. "..
	"valid Modes are \"mesh\" and \"ether\". Default is \"mesh\"."))
mode:value("mesh")  
mode:value("ether")
mode.optional = true
mode.rmempty = true

i:option(Value, "Ip4Broadcast", translate("IPv4 broadcast"),
	translate("IPv4 broadcast address for outgoing OLSR packets. One useful example would be 255.255.255.255. "..
	"Default is \"0.0.0.0\", which triggers the usage of the interface broadcast IP.")).optional = true

i:option(Value, "IPv6Multicast", translate("IPv6 multicast"),
	translate("IPv6 multicast address. Default is \"FF02::6D\", the manet-router linklocal multicast.")).optional = true

i:option(Value, "IPv4Src", translate("IPv4 source"),
	translate("IPv4 src address for outgoing OLSR packages. Default is \"0.0.0.0\", which triggers usage of the interface IP.")).optional = true

i:option(Value, "IPv6Src", translate("IPv6 source"),
	translate("IPv6 src prefix. OLSRd will choose one of the interface IPs which matches the prefix of this parameter. "..
	"Default is \"0::/0\", which triggers the usage of a not-linklocal interface IP.")).optional = true

i:option(Value, "HelloInterval", translate("Hello interval")).optional = true
i:option(Value, "HelloValidityTime", translate("Hello validity time")).optional = true
i:option(Value, "TcInterval", translate("TC interval")).optional = true
i:option(Value, "TcValidityTime", translate("TC validity time")).optional = true
i:option(Value, "MidInterval", translate("MID interval")).optional = true
i:option(Value, "MidValidityTime", translate("MID validity time")).optional = true
i:option(Value, "HnaInterval", translate("HNA interval")).optional = true
i:option(Value, "HnaValidityTime", translate("HNA validity time")).optional = true

i:option(Value, "Weight", translate("Weight"),
	translate("When multiple links exist between hosts the weight of interface is used to determine the link to use. "..
	"Normally the weight is automatically calculated by olsrd based on the characteristics of the interface, "..
	"but here you can specify a fixed value. Olsrd will choose links with the lowest value.<br />"..
	"<b>Note:</b> Interface weight is used only when LinkQualityLevel is set to 0. "..
	"For any other value of LinkQualityLevel, the interface ETX value is used instead.")).optional = true

lqmult = i:option(DynamicList, "LinkQualityMult", translate("LinkQuality Multiplicator"),
	translate("Multiply routes with the factor given here. Allowed values are between 0.01 and 1. "..
	"It is only used when LQ-Level is greater than 0. Examples:<br />"..
	"reduce LQ to 192.168.0.1 by half: 192.168.0.1 0.5<br />"..
	"reduce LQ to all nodes on this interface by 20%: default 0.8"))
lqmult.optional = true
lqmult.rmempty = true
lqmult.cast = "table"

return m
