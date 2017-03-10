-- Copyright 2017 Mauro Mozzarelli <mauro@ezplanet.org>
-- Licensed to the public under the Apache License 2.0.

local sys = require "luci.sys"
local net = require "luci.model.network".init()

map = Map("ipvs", translate("Virtual Server Details"), translate("VS Load Balancer: Configure Virtual Server Details")) -- Edit config file /etc/config/ipvs
map.redirect = luci.dispatcher.build_url("admin/network/ipvs")

function map.on_before_commit(self)
	sys.exec("/etc/init.d/ipvsadm stop")
end
function map.on_after_commit(self)
	sys.exec("/etc/init.d/ipvsadm start")
end

-- Virtual Server Section
vs = map:section(NamedSection, arg[1], "virtual", translatef("Virtual Server %q", arg[1]))

ena = vs:option(Flag, "enabled", translate("Enabled"))

vip = vs:option(Value, "vip", translate("Virtual IPv4"))
vip.datatype = "ip4addr"

vni = vs:option(Value, "interface", translate("Router Interface"))
vni.template    = "cbi/network_netlist"
vni.nocreate    = true
vni.unspecified = false

ali = vs:option(Value, "alias", translate("Interface alias"), translate("Absolute value, must not be the same as another virtual server using the same interface (if unsure leave blank)"))
ali.datatype = "range(1,240)"

sch = vs:option(ListValue, "scheduler", translate("Scheduler"))
sch:value("rr"   , "Round Robin")
sch:value("wrr"  , "Weighted Round Robin")
sch:value("lc"   , "Least Connections")
sch:value("wlc"  , "Weighted Least Connections")
sch:value("dh"   , "Destination Hash")
sch:value("sh"   , "Source Hash")
sch:value("lblc" , "Locality-Based Least Connections")
sch:value("lblcr", "Locality-Based Least Connections with Replication")
sch:value("sed"  , "Shortest Expected Delay")
sch:value("nq"   , "Never Queue")

per = vs:option(Flag, "persistent", translate("Persistent"))

-- Physical Server Section
rs = vs:option(DynamicList, "real", "Real Servers")
map.uci:foreach("ipvs", "real",
function(s)	
	rs:value(s[".name"])
end)

-- Virtual Server Section
ipp = map:section(TypedSection, arg[1], "IP Forward")
ipp.template = "cbi/tblsection"
ipp.anonymous = true
ipp.addremove = true

protocol = ipp:option(ListValue, "protocol", translate("Protocol"))
protocol:value("tcp", "tcp")
protocol:value("udp", "udp")

ipp:option(Value, "src_port", translate("Source Port"), translate("0 or blank=all ports (requires Direct Routing)"))
ipp:option(Value, "dest_port", translate("Destination Port"), translate("applies to Masquerade only, otherwise ignored"))

return map

