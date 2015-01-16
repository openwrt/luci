-- Copyright 2010 Jo-Philipp Wich <jow@openwrt.org>
-- Licensed to the public under the Apache License 2.0.

local sid = arg[1]
local utl = require "luci.util"

m = Map("radvd", translatef("Radvd - Interface %q", "?"),
	translate("Radvd is a router advertisement daemon for IPv6. " ..
		"It listens to router solicitations and sends router advertisements " ..
		"as described in RFC 4861."))

m.redirect = luci.dispatcher.build_url("admin/network/radvd")

if m.uci:get("radvd", sid) ~= "interface" then
	luci.http.redirect(m.redirect)
	return
end

m.uci:foreach("radvd", "interface",
	function(s)
		if s['.name'] == sid and s.interface then
			m.title = translatef("Radvd - Interface %q", s.interface)
			return false
		end
	end)


s = m:section(NamedSection, sid, "interface", translate("Interface Configuration"))
s.addremove = false

s:tab("general", translate("General"))
s:tab("timing",  translate("Timing"))
s:tab("mobile",  translate("Mobile IPv6"))


--
-- General
--

o = s:taboption("general", Flag, "ignore", translate("Enable"))
o.rmempty = false

function o.cfgvalue(...)
	local v = Flag.cfgvalue(...)
	return v == "1" and "0" or "1"
end

function o.write(self, section, value)
	Flag.write(self, section, value == "1" and "0" or "1")
end


o = s:taboption("general", Value, "interface", translate("Interface"),
	translate("Specifies the logical interface name this section belongs to"))

o.template = "cbi/network_netlist"
o.nocreate = true
o.optional = false

function o.formvalue(...)
	return Value.formvalue(...) or "-"
end

function o.validate(self, value)
	if value == "-" then
		return nil, translate("Interface required")
	end
	return value
end

function o.write(self, section, value)
	m.uci:set("radvd", section, "ignore", 0)
	m.uci:set("radvd", section, "interface", value)
end


o = s:taboption("general", DynamicList, "client", translate("Clients"),
	translate("Restrict communication to specified clients, leave empty to use multicast"))

o.rmempty     = true
o.datatype    = "ip6addr"
o.placeholder = "any"
function o.cfgvalue(...)
	local v = Value.cfgvalue(...)
	local l = { }
	for v in utl.imatch(v) do
		l[#l+1] = v
	end
	return l
end


o = s:taboption("general", Flag, "AdvSendAdvert", translate("Enable advertisements"),
	translate("Enables router advertisements and solicitations"))

o.rmempty = false
function o.write(self, section, value)
	if value == "1" then
		m.uci:set("radvd", section, "ignore", 0)
		m.uci:set("radvd", section, "IgnoreIfMissing", 1)
	end

	m.uci:set("radvd", section, "AdvSendAdvert", value)
end


o = s:taboption("general", Flag, "UnicastOnly", translate("Unicast only"),
	translate("Indicates that the underlying link is not broadcast capable, prevents unsolicited advertisements from being sent"))

o:depends("AdvSendAdvert", "1")


o = s:taboption("general", Flag, "AdvManagedFlag", translate("Managed flag"),
	translate("Enables the additional stateful administered autoconfiguration protocol (RFC2462)"))

o:depends("AdvSendAdvert", "1")


o = s:taboption("general", Flag, "AdvOtherConfigFlag", translate("Configuration flag"),
	translate("Enables the autoconfiguration of additional, non address information (RFC2462)"))

o:depends("AdvSendAdvert", "1")


o = s:taboption("general", Flag, "AdvSourceLLAddress", translate("Source link-layer address"),
	translate("Includes the link-layer address of the outgoing interface in the RA"))

o.rmempty = false
o.default = "1"
o:depends("AdvSendAdvert", "1")


o = s:taboption("general", Value, "AdvLinkMTU", translate("Link MTU"),
	translate("Advertises the given link MTU in the RA if specified. 0 disables MTU advertisements"))

o.datatype = "uinteger"
o.placeholder = 0
o:depends("AdvSendAdvert", "1")


o = s:taboption("general", Value, "AdvCurHopLimit", translate("Current hop limit"),
	translate("Advertises the default Hop Count value for outgoing unicast packets in the RA. 0 disables hopcount advertisements"))

o.datatype = "uinteger"
o.optional = false
o.placeholder = 64
o:depends("AdvSendAdvert", "1")


o = s:taboption("general", ListValue, "AdvDefaultPreference", translate("Default preference"),
	translate("Advertises the default router preference"))

o.optional = false
o.default = "medium"
o:value("low",    translate("low"))
o:value("medium", translate("medium"))
o:value("high",   translate("high"))
o:depends("AdvSendAdvert", "1")


--
-- Timing
--

o = s:taboption("timing", Value, "MinRtrAdvInterval", translate("Minimum advertisement interval"),
	translate("The minimum time allowed between sending unsolicited multicast router advertisements from the interface, in seconds"))

o.datatype = "uinteger"
o.optional = false
o.placeholder = 198
o:depends("AdvSendAdvert", "1")


o = s:taboption("timing", Value, "MaxRtrAdvInterval", translate("Maximum advertisement interval"),
	translate("The maximum time allowed between sending unsolicited multicast router advertisements from the interface, in seconds"))

o.datatype = "uinteger"
o.optional = false
o.placeholder = 600
o:depends("AdvSendAdvert", "1")


o = s:taboption("timing", Value, "MinDelayBetweenRAs", translate("Minimum advertisement delay"),
	translate("The minimum time allowed between sending multicast router advertisements from the interface, in seconds"))

o.datatype = "uinteger"
o.optional = false
o.placeholder = 3
o:depends("AdvSendAdvert", "1")


o = s:taboption("timing", Value, "AdvReachableTime", translate("Reachable time"),
	translate("Advertises assumed reachability time in milliseconds of neighbours in the RA if specified. 0 disables reachability advertisements"))

o.datatype = "uinteger"
o.optional = false
o.placeholder = 0
o:depends("AdvSendAdvert", "1")


o = s:taboption("timing", Value, "AdvRetransTimer", translate("Retransmit timer"),
	translate("Advertises wait time in milliseconds between Neighbor Solicitation messages in the RA if specified. 0 disables retransmit advertisements"))

o.datatype = "uinteger"
o.optional = false
o.placeholder = 0
o:depends("AdvSendAdvert", "1")


o = s:taboption("timing", Value, "AdvDefaultLifetime", translate("Default lifetime"),
	translate("Advertises the lifetime of the default router in seconds. 0 indicates that the node is no default router"))

o.datatype = "uinteger"
o.optional = false
o.placeholder = 1800
o:depends("AdvSendAdvert", "1")


--
-- Mobile
--

o = s:taboption("mobile", Flag, "AdvHomeAgentFlag", translate("Advertise Home Agent flag"),
	translate("Advertises Mobile IPv6 Home Agent capability (RFC3775)"))

o:depends("AdvSendAdvert", "1")


o = s:taboption("mobile", Flag, "AdvIntervalOpt", translate("Mobile IPv6 interval option"),
	translate("Include Mobile IPv6 Advertisement Interval option to RA"))

o:depends({AdvHomeAgentFlag = "1", AdvSendAdvert = "1"})


o = s:taboption("mobile", Flag, "AdvHomeAgentInfo", translate("Home Agent information"),
	translate("Include Home Agent Information in the RA"))

o:depends({AdvHomeAgentFlag = "1", AdvSendAdvert = "1"})


o = s:taboption("mobile", Flag, "AdvMobRtrSupportFlag", translate("Mobile IPv6 router registration"),
	translate("Advertises Mobile Router registration capability (NEMO Basic)"))

o:depends({AdvHomeAgentInfo = "1", AdvSendAdvert = "1"})


o = s:taboption("mobile", Value, "HomeAgentLifetime", translate("Home Agent lifetime"),
	translate("Advertises the time in seconds the router is offering Mobile IPv6 Home Agent services"))

o.datatype = "uinteger"
o.optional = false
o.placeholder = 1800
o:depends({AdvHomeAgentInfo = "1", AdvSendAdvert = "1"})


o = s:taboption("mobile", Value, "HomeAgentPreference", translate("Home Agent preference"),
	translate("The preference for the Home Agent sending this RA"))

o.datatype = "uinteger"
o.optional = false
o.placeholder = 0
o:depends({AdvHomeAgentInfo = "1", AdvSendAdvert = "1"})


return m
