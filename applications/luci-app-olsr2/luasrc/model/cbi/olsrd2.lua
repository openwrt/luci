-- Copyright 2008 Steven Barth <steven@midlink.org>
-- Copyright 2010 Jo-Philipp Wich <jow@openwrt.org>
-- Licensed to the public under the Apache License 2.0.

require("luci.tools.webadmin")
local utl = require "luci.util"
local nwm = require "luci.model.network".init()
local net, iface, arg_if
local networks = nwm:get_networks()

m = Map("olsrd2", translate("OLSR2 Daemon"),
	translate("olsrd2 implements the IETF <a href='http://tools.ietf.org/html/rfc6130'>RFC 6130: Neighborhood Discovery Protocol (NHDP)</a> and <a href='http://tools.ietf.org/html/rfc7181'>RFC 7181: Optimized Link State Routing Protocol v2.</a>"))

if arg[1] and m.uci:get("olsrd2", arg[1]) == "interface" then
	arg_if = arg[1]
end

if not arg_if then

	s = m:section(TypedSection, "global", translate("global settings"))
	s.anonymous = true
	s.addremove = true
	local svc = s:option(Flag, "failfast", "failfast")
	svc.optional = true
	local svc = s:option(Value, "pidfile", "pidfile")
	svc.rmempty = false
	svc.optional = true
	svc.placeholder = "/var/run/olsrd2.pid"
	svc.datatype = "string"
	local svc = s:option(Value, "lockfile", "lockfile")
	svc.rmempty = false
	svc.optional = true
	svc.placeholder = "/var/lock/olsrd2"
	svc.datatype = "string"
	
	s = m:section(TypedSection, "log", translate("log settings"))
	s.anonymous = true
	s.addremove = true
	local svc = s:option(Flag, "syslog", "syslog")
	svc.optional = true
	local svc = s:option(Flag, "stderr", "stderr")
	svc.optional = true
	
	s = m:section(TypedSection, "olsrv2", translate("olsrv2 settings"))
	s.anonymous = true
	s.addremove = true
	local svc = s:option(Value, "tc_interval", translate("defines the time between two TC messages."), "s")
	svc.optional    = true
	svc.placeholder = 5.0
	svc.datatype    = "ufloat"
	local svc = s:option(Value, "tc_validity", translate("tc_validity defines the validity time of the TC messages."), "s")
	svc.optional    = true
	svc.placeholder = 300.0
	svc.datatype    = "ufloat"
	local svc = s:option(Value, "forward_hold_time", translate("forward_hold_time defines the time until the router will forget an entry in its forwarding duplicate database."), "s")
	svc.optional    = true
	svc.placeholder = 300.0
	svc.datatype    = "ufloat"
	local svc = s:option(Value, "processing_hold_time", translate("processing_hold_time defines the time until the router will forget an entry in its processing duplicate database."), "s")
	svc.optional    = true
	svc.placeholder = 300.0
	svc.datatype    = "ufloat"
	local svc = s:option(DynamicList, "routable", translate("routable defines the ACL which declares an IP address routable. Other IP addresses will not be included in TC messages."), "ip6prefix, ip4prefix, default_accept, default_reject")
	svc.datatype = "or(ip6prefix, negm(ip6prefix), ip4prefix, negm(ip4prefix), 'default_accept', 'default_reject')"
	svc.optional = true
	local svc = s:option(DynamicList, "lan", translate("lan defines the locally attached network prefixes (similar to HNAs in OLSR v1). A LAN entry is a IP address/prefix, followed (optionally) by up to three key=value pairs defining the metric cost, hopcount distance and domain of the LAN ( <metric=...> <dist=...> <domain=...> )."), "ip6prefix, ip4prefix, default_accept")
	svc.datatype = "string"
	--svc.datatype = "or(ip6prefix, ip4prefix, 'src=')"
	svc.optional = true
	local svc = s:option(DynamicList, "originator", translate("originator defines the ACL which declares a valid originator IP address for the router."), "ip6prefix, ip4prefix, default_accept, default_reject")
	svc.datatype = "or(ip6prefix, negm(ip6prefix), ip4prefix, negm(ip4prefix), 'default_accept', 'default_reject')"
	svc.optional = true
	
	s = m:section(TypedSection, "domain", translate("domain settings"))
	s.anonymous = true
	s.addremove = true
	local svc = s:option(Value, "table", translate("table defines the routing table for the local routing entries."), "0-254")
	svc.optional    = true
	svc.placeholder = 254
	svc.datatype    = "range(0,254)"
	local svc = s:option(Value, "protocol", translate("protocol defines the protocol number for the local routing entries."), "0-254")
	svc.optional    = true
	svc.placeholder = 100
	svc.datatype    = "range(0,254)"
	local svc = s:option(Value, "distance", translate("distance defines the 'metric' (hopcount) of the local routing entries."), "0-254")
	svc.optional    = true
	svc.placeholder = 2
	svc.datatype    = "range(0,254)"
	local svc = s:option(Flag, "srcip_routes", translate("srcip_routes defines if the router sets the originator address as the source-ip entry into the local routing entries."))
	svc.optional = true
	
	s = m:section(TypedSection, "mesh", translate("mesh settings"))
	s.anonymous = true
	s.addremove = true
	local svc = s:option(Value, "port", translate("port defines the UDP port number of the RFC5444 socket."), "1-65535")
	svc.optional    = true
	svc.placeholder = 269
	svc.datatype    = "range(1,65535)"
	local svc = s:option(Value, "ip_proto", translate("ip_proto defines the IP protocol number that can be used for RFC5444 communication."), "1-255")
	svc.optional    = true
	svc.placeholder = 138
	svc.datatype    = "range(1,255)"
	local svc = s:option(Value, "aggregation_interval", translate("aggregation_interval defines the time the local RFC5444 implementation will keep messages to aggregate them before creating a new RFC5444 packet to forward them."), ">0.1 s")
	svc.optional    = true
	svc.placeholder = 1.0
	svc.datatype    = "and(min(0.1), ufloat)"
	
	s = m:section(TypedSection, "lan_import", translate("LAN import settings"))
	s.anonymous = true
	s.addremove = true
	local svc = s:option(Value, "name", translate("Name"), "Text")
	svc.datatype    = "string"
	local svc = s:option(Value, "interface", translate("Interface"), "Name Interface")
	svc.datatype    = "string"
	local svc = s:option(Value, "table", translate("IP Table"), "1-255")
	svc.datatype    = "range(1,255)"
	local svc = s:option(Value, "protocol", translate("IP protocol"), "1-255")
	svc.datatype    = "range(1,255)"

	ifs = m:section(TypedSection, "interface", translate("interface settings"))
	ifs.anonymous = true
	ifs.addremove = true
	ifs.extedit   = luci.dispatcher.build_url("admin/services/olsrd2/%s")
	ifs.template  = "cbi/tblsection"
	ifs:tab("general", translate("General Settings"))
else
	ifs = m:section(NamedSection, arg_if, "interface", translate("interface"))
	ifs.anonymous = true
	ifs.addremove = true
	ifs:tab("general", translate("General Settings"))
	ifs:tab("oonf",   translate("OONF RFC5444 Plugin"))
	ifs:tab("nhdp",   translate("NHDP Plugin"))
	ifs:tab("link",   translate("Link Config Plugin"))
end

local ign = ifs:taboption("general",Flag, "ignore", translate("Enable"))
ign.enabled  = "0"
ign.disabled = "1"
ign.rmempty = false
function ign.cfgvalue(self, section)
	return Flag.cfgvalue(self, section) or "0"
end
local svc = ifs:taboption("general", Value, "ifname", translate("Network"),
translate("The interface OLSR2 should serve."))
for _, net in ipairs(networks) do
	if (not net:is_virtual()) then
		svc:value(net:name())
	end
end
svc.widget   = "select"
svc.nocreate = true

if arg_if then
	local svc = ifs:taboption("oonf", DynamicList, "acl", translate("acl defines the IP addresses that are allowed to use the RFC5444 socket."), "ip6prefix, ip4prefix, default_accept, default_reject")
	svc.datatype = "or(ip6prefix, negm(ip6prefix), ip4prefix, negm(ip4prefix), 'default_accept', 'default_reject')"
	svc.optional = true
	local svc = ifs:taboption("oonf", DynamicList, "bindto", translate("bindto defines the IP addresses which the RFC5444 socket will be bound to."), "ip6prefix, ip4prefix, default_accept, default_reject")
	svc.datatype = "or(ip6prefix, negm(ip6prefix), ip4prefix, negm(ip4prefix), 'default_accept', 'default_reject')"
	svc.optional = true
	local svc = ifs:taboption("oonf", Value, "multicast_v4", translate("multicast_v4 defines the IPv4 multicast address used for RFC5444 packets."), "ip4addr")
	svc.datatype = "ip4addr"
	svc.placeholder = "224.0.0.109"
	svc.optional = true
	local svc = ifs:taboption("oonf", Value, "multicast_v6", translate("multicast_v6 defines the IPv4 multicast address used for RFC5444 packets."), "ip4addr")
	svc.datatype = "ip6addr"
	svc.placeholder = "ff02::6d"
	svc.optional = true
	local svc = ifs:taboption("oonf", Value, "dscp", translate("dscp defines the DSCP value set for each outgoing RFC5444 packet. The value must be between 0 and 252 without fractional digits. The value should be a multiple of 4."), "0-255")
	svc.optional    = true
	svc.placeholder = 192
	svc.datatype    = "range(0,255)"
	local svc = ifs:taboption("oonf", Flag, "rawip", translate("rawip defines if the interface should put RFC5444 packets directly into IP headers (skipping the UDP header)."))
	svc.optional = true
	local svc = ifs:taboption("nhdp", DynamicList, "ifaddr_filter", translate("ifaddr_filter defines the IP addresses that are allowed to NHDP interface addresses."), "ip6prefix, ip4prefix, default_accept, default_reject")
	svc.datatype = "or(ip6prefix, negm(ip6prefix), ip4prefix, negm(ip4prefix), 'default_accept', 'default_reject')"
	svc.optional = true
	local svc = ifs:taboption("nhdp", Value, "hello_validity", translate("hello_validity defines the time the local HELLO messages will be valid for the neighbors."), ">0.1 s")
	svc.optional    = true
	svc.placeholder = 20.0
	svc.datatype    = "and(min(0.1), ufloat)"
	local svc = ifs:taboption("nhdp", Value, "hello_interval", translate("hello_interval defines the time between two HELLO messages on the interface."), ">0.1 s")
	svc.optional = true
	svc.placeholder = 2.0
	svc.datatype = "and(min(0.1), ufloat)"
	local svc = ifs:taboption("link", Value, "rx_bitrate", translate("rx_bitrate"))
	svc.optional = true
	svc.rmempty = false
	svc.placeholder = "1G"
	svc.datatype = "string"
	local svc = ifs:taboption("link", Value, "tx_bitrate", translate("tx_bitrate"))
	svc.optional = true
	svc.rmempty = false
	svc.placeholder = "1G"
	svc.datatype = "string"
	local svc = ifs:taboption("link", Value, "rx_max_bitrate", translate("rx_max_bitrate"))
	svc.optional = true
	svc.rmempty = false
	svc.placeholder = "1G"
	svc.datatype = "string"
	local svc = ifs:taboption("link", Value, "tx_max_bitrate", translate("tx_max_bitrate"))
	svc.optional = true
	svc.rmempty = false
	svc.placeholder = "1G"
	svc.datatype = "string"
	local svc = ifs:taboption("link", Value, "rx_signal", translate("rx_signal"))
	svc.optional = true
	svc.rmempty = false
	svc.placeholder = "1G"
	svc.datatype = "string"
end
return m
