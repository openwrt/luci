-- Copyright 2017 Mauro Mozzarelli <mauro@ezplanet.org>
-- Licensed to the public under the Apache License 2.0.

local sys = require "luci.sys"
local ds  = require "luci.dispatcher"
local net = require "luci.model.network".init()

map = Map("ipvs", "Virtual Server Load Balancer", translate("Configure Virtual Server Load Balancer")) -- Edit config file /etc/config/ipvs

function map.on_before_commit(self)
	sys.exec("/etc/init.d/ipvsadm stop")
end
function map.on_after_commit(self)
	sys.exec("/etc/init.d/ipvsadm start")
end

-- General Section
gl = map:section(TypedSection, "vipvs", translate("General"))

on = gl:option(Flag, "enabled", "Enabled")
on.default = "0"

role = gl:option(ListValue, "role", "Role")
role:value("master", "Master")
role:value("backup", "Backup")

master = gl:option(Value, "master", translate("Master IPv4 address"))
master:depends("role", "backup")
master.optional = false
master.datatype = "ip4addr"

ni = gl:option(Value, "interface", translate("Interface"),
	translate("Multicast interface for connection sync"))

ni.template    = "cbi/network_netlist"
ni.nocreate    = true
ni.unspecified = false

sid = gl:option(Value, "syncid", translate("Id for connection sync"), translate("0=no filtering; 1-255 = synchronize only with servers using matching Id"))
sid.datatype = "range(0,255)"
sid.default = "1"

ali = gl:option(Value, "alias_offset", translate("Interface alias displacement"))
ali.default = "0"
ali.datatype = "range(0,100)"

-- Real Servers Section
rs = map:section(TypedSection, "real", "Real Servers")
rs.template = "cbi/tblsection"
rs.anonymous = false
rs.addremove = true
rs.extedit = ds.build_url("admin", "network", "ipvs", "real", "%s")

rip = rs:option(Value, "ipaddr", translate("IP Address"))
rip.datatype = "ip4addr"

pfw = rs:option(ListValue, "packet_forwarding", translate("Packet Forwarding"))
pfw:value("direct", "Direct Routing")
pfw:value("tunnel", "Tunneling")
pfw:value("nat", "Masquerading (NAT)")

wgt = rs:option(Value, "weight", translate("Weight"))
wgt.datatype = "range(1,65535)"

-- Virtual Server Section
vs = map:section(TypedSection, "virtual", translate("Virtual Servers"))
vs.template = "cbi/tblsection"
vs.anonymous = false
vs.addremove = true
vs.extedit = ds.build_url("admin", "network", "ipvs", "virtual", "%s")

vs:option(Flag, "enabled", translate("Enabled"))
vs:option(DummyValue, "interface", translate("Interface"))
vs:option(DummyValue, "vip", translate("Virtual IPv4"))
vs:option(DummyValue, "scheduler", translate("Scheduler"))

return map

