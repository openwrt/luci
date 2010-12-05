--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>
Copyright 2010 Jo-Philipp Wich <xm@subsignal.org>

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

function m.on_parse()
	local has_defaults = false

	m.uci:foreach("olsrd", "InterfaceDefaults",
		function(s)
			has_defaults = true
			return false
		end)

	if not has_defaults then
		m.uci:section("olsrd", "InterfaceDefaults")
	end
end

s = m:section(TypedSection, "olsrd", translate("General settings"))
--s.dynamic = true
s.anonymous = true

s:tab("general",  translate("General Settings"))
s:tab("lquality", translate("Link Quality Settings"))
s:tab("advanced", translate("Advanced Settings"))


ipv = s:taboption("general", ListValue, "IpVersion", translate("Internet protocol"),
	translate("IP-version to use. If 6and4 is selected then one olsrd instance is started for each protocol."))
ipv:value("4", "IPv4")
ipv:value("6", "IPv6")
ipv:value("6and4", "6and4")


poll = s:taboption("advanced", Value, "Pollrate", translate("Pollrate"),
	translate("Polling rate for OLSR sockets in seconds. Default is 0.05."))
poll.optional = true
poll.datatype = "ufloat"
poll.placeholder = "0.05"

nicc = s:taboption("advanced", Value, "NicChgsPollInt", translate("Nic changes poll interval"),
	translate("Interval to poll network interfaces for configuration changes (in seconds). Default is \"2.5\"."))
nicc.optional = true
nicc.datatype = "ufloat"
nicc.placeholder = "2.5"

tos = s:taboption("advanced", Value, "TosValue", translate("TOS value"),
	translate("Type of service value for the IP header of control traffic. Default is \"16\"."))
tos.optional = true
tos.datatype = "uinteger"
tos.placeholder = "16"

fib = s:taboption("general", ListValue, "FIBMetric", translate("FIB metric"),
	translate ("FIBMetric controls the metric value of the host-routes OLSRd sets. "..
	"\"flat\" means that the metric value is always 2. This is the preferred value "..
	"because it helps the linux kernel routing to clean up older routes. "..
	"\"correct\" uses the hopcount as the metric value. "..
	"\"approx\" use the hopcount as the metric value too, but does only update the hopcount if the nexthop changes too. "..
	"Default is \"flat\"."))
fib:value("flat")
fib:value("correct")
fib:value("approx")

lql = s:taboption("lquality", ListValue, "LinkQualityLevel", translate("LQ level"),
	translate("Link quality level switch between hopcount and cost-based (mostly ETX) routing.<br />"..
	"<b>0</b> = do not use link quality<br />"..
	"<b>2</b> = use link quality for MPR selection and routing<br />"..
	"Default is \"2\""))
lql:value("2")
lql:value("0")

lqage = s:taboption("lquality", Value, "LinkQualityAging", translate("LQ aging"),
	translate("Link quality aging factor (only for lq level 2). Tuning parameter for etx_float and etx_fpm, smaller values "..
	"mean slower changes of ETX value. (allowed values are between 0.01 and 1.0)"))
lqage.optional = true
lqage:depends("LinkQualityLevel", "2")

lqa = s:taboption("lquality", ListValue, "LinkQualityAlgorithm", translate("LQ algorithm"),
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

lqfish = s:taboption("lquality", Flag, "LinkQualityFishEye", translate("LQ fisheye"),
	translate("Fisheye mechanism for TCs (checked means on). Default is \"on\""))
lqfish.default = "1"
lqfish.optional = true

hyst = s:taboption("lquality", Flag, "UseHysteresis", translate("Use hysteresis"),
	translate("Hysteresis for link sensing (only for hopcount metric). Hysteresis adds more robustness to the link sensing "..
	"but delays neighbor registration. Defaults is \"yes\""))
hyst.default = "yes"
hyst.enabled = "yes"
hyst.disabled = "no"
hyst:depends("LinkQualityLevel", "0")
hyst.optional = true

port = s:taboption("general", Value, "OlsrPort", translate("Port"),
        translate("The port OLSR uses. This should usually stay at the IANA assigned port 698. It can have a value between 1 and 65535."))
port.optional = true
port.default = "698"
port.rmempty = true

mainip = s:taboption("general", Value, "MainIp", translate("Main IP"),
        translate("Sets the main IP (originator ip) of the router. This IP will NEVER change during the uptime of olsrd. "..
	"Default is 0.0.0.0, which triggers usage of the IP of the first interface."))
mainip.optional = true
mainip.rmempty = true
mainip.datatype = "ipaddr"
mainip.placeholder = "0.0.0.0"

willingness = s:taboption("advanced", ListValue, "Willingness", translate("Willingness"),
		translate("The fixed willingness to use. If not set willingness will be calculated dynamically based on battery/power status. Default is \"3\"."))
for i=0,7 do
	willingness:value(i)
end
willingness.optional = true
willingness.default = "3"

natthr = s:taboption("advanced", Value, "NatThreshold", translate("NAT threshold"),
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


i = m:section(TypedSection, "InterfaceDefaults", translate("Interfaces Defaults"))
i.anonymous = true
i.addremove = false

i:tab("general", translate("General Settings"))
i:tab("addrs",   translate("IP Addresses"))
i:tab("timing",  translate("Timing and Validity"))

mode = i:taboption("general", ListValue, "Mode", translate("Mode"),
	translate("Interface Mode is used to prevent unnecessary packet forwarding on switched ethernet interfaces. "..
	"valid Modes are \"mesh\" and \"ether\". Default is \"mesh\"."))
mode:value("mesh")
mode:value("ether")
mode.optional = true
mode.rmempty = true


weight = i:taboption("general", Value, "Weight", translate("Weight"),
	translate("When multiple links exist between hosts the weight of interface is used to determine the link to use. "..
	"Normally the weight is automatically calculated by olsrd based on the characteristics of the interface, "..
	"but here you can specify a fixed value. Olsrd will choose links with the lowest value.<br />"..
	"<b>Note:</b> Interface weight is used only when LinkQualityLevel is set to 0. "..
	"For any other value of LinkQualityLevel, the interface ETX value is used instead."))
weight.optional = true
weight.datatype = "uinteger"
weight.placeholder = "0"

lqmult = i:taboption("general", DynamicList, "LinkQualityMult", translate("LinkQuality Multiplicator"),
	translate("Multiply routes with the factor given here. Allowed values are between 0.01 and 1. "..
	"It is only used when LQ-Level is greater than 0. Examples:<br />"..
	"reduce LQ to 192.168.0.1 by half: 192.168.0.1 0.5<br />"..
	"reduce LQ to all nodes on this interface by 20%: default 0.8"))
lqmult.optional = true
lqmult.rmempty = true
lqmult.cast = "table"
lqmult.placeholder = "default 1.0"


ip4b = i:taboption("addrs", Value, "Ip4Broadcast", translate("IPv4 broadcast"),
	translate("IPv4 broadcast address for outgoing OLSR packets. One useful example would be 255.255.255.255. "..
	"Default is \"0.0.0.0\", which triggers the usage of the interface broadcast IP."))
ip4b.optional = true
ip4b.datatype = "ip4addr"
ip4b.placeholder = "0.0.0.0"

ip6m = i:taboption("addrs", Value, "IPv6Multicast", translate("IPv6 multicast"),
	translate("IPv6 multicast address. Default is \"FF02::6D\", the manet-router linklocal multicast."))
ip6m.optional = true
ip6m.datatype = "ip6addr"
ip6m.placeholder = "FF02::6D"

ip4s = i:taboption("addrs", Value, "IPv4Src", translate("IPv4 source"),
	translate("IPv4 src address for outgoing OLSR packages. Default is \"0.0.0.0\", which triggers usage of the interface IP."))
ip4s.optional = true
ip4s.datatype = "ip4addr"
ip4s.placeholder = "0.0.0.0"

ip6s = i:taboption("addrs", Value, "IPv6Src", translate("IPv6 source"),
	translate("IPv6 src prefix. OLSRd will choose one of the interface IPs which matches the prefix of this parameter. "..
	"Default is \"0::/0\", which triggers the usage of a not-linklocal interface IP."))
ip6s.optional = true
ip6s.datatype = "ip6addr"
ip6s.placeholder = "0::/0"


hi = i:taboption("timing", Value, "HelloInterval", translate("Hello interval"))
hi.optional = true
hi.datatype = "ufloat"
hi.placeholder = "5.0"

hv = i:taboption("timing", Value, "HelloValidityTime", translate("Hello validity time"))
hv.optional = true
hv.datatype = "ufloat"
hv.placeholder = "40.0"

ti = i:taboption("timing", Value, "TcInterval", translate("TC interval"))
ti.optional = true
ti.datatype = "ufloat"
ti.placeholder = "2.0"

tv = i:taboption("timing", Value, "TcValidityTime", translate("TC validity time"))
tv.optional = true
tv.datatype = "ufloat"
tv.placeholder = "256.0"

mi = i:taboption("timing", Value, "MidInterval", translate("MID interval"))
mi.optional = true
mi.datatype = "ufloat"
mi.placeholder = "18.0"

mv = i:taboption("timing", Value, "MidValidityTime", translate("MID validity time"))
mv.optional = true
mv.datatype = "ufloat"
mv.placeholder = "324.0"

ai = i:taboption("timing", Value, "HnaInterval", translate("HNA interval"))
ai.optional = true
ai.datatype = "ufloat"
ai.placeholder = "18.0"

av = i:taboption("timing", Value, "HnaValidityTime", translate("HNA validity time"))
av.optional = true
av.datatype = "ufloat"
av.placeholder = "108.0"


ifs = m:section(TypedSection, "Interface", translate("Interfaces"))
ifs.addremove = true
ifs.anonymous = true
ifs.extedit   = luci.dispatcher.build_url("admin/services/olsrd/iface/%s")
ifs.template  = "cbi/tblsection"

function ifs.create(...)
	local sid = TypedSection.create(...)
	luci.http.redirect(ifs.extedit % sid)
end

ign = ifs:option(Flag, "ignore", translate("Enable"))
ign.enabled  = "0"
ign.disabled = "1"
ign.rmempty = false
function ign.cfgvalue(self, section)
	return Flag.cfgvalue(self, section) or "0"
end

network = ifs:option(DummyValue, "interface", translate("Network"))
network.template = "cbi/network_netinfo"

mode = ifs:option(DummyValue, "Mode", translate("Mode"))
function mode.cfgvalue(...)
	return Value.cfgvalue(...) or "mesh"
end

hello = ifs:option(DummyValue, "_hello", translate("Hello"))
function hello.cfgvalue(self, section)
	local i = tonumber(m.uci:get("olsrd", section, "HelloInterval"))     or 5
	local v = tonumber(m.uci:get("olsrd", section, "HelloValidityTime")) or 40
	return "%.01fs / %.01fs" %{ i, v }
end

tc = ifs:option(DummyValue, "_tc", translate("TC"))
function tc.cfgvalue(self, section)
	local i = tonumber(m.uci:get("olsrd", section, "TcInterval"))     or 2
	local v = tonumber(m.uci:get("olsrd", section, "TcValidityTime")) or 256
	return "%.01fs / %.01fs" %{ i, v }
end

mid = ifs:option(DummyValue, "_mid", translate("MID"))
function mid.cfgvalue(self, section)
	local i = tonumber(m.uci:get("olsrd", section, "MidInterval"))     or 18
	local v = tonumber(m.uci:get("olsrd", section, "MidValidityTime")) or 324
	return "%.01fs / %.01fs" %{ i, v }
end

hna = ifs:option(DummyValue, "_hna", translate("HNA"))
function hna.cfgvalue(self, section)
	local i = tonumber(m.uci:get("olsrd", section, "HnaInterval"))     or 18
	local v = tonumber(m.uci:get("olsrd", section, "HnaValidityTime")) or 108
	return "%.01fs / %.01fs" %{ i, v }
end

return m
