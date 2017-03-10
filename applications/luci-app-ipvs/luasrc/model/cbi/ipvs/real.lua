-- Copyright 2017 Mauro Mozzarelli <mauro@ezplanet.org>
-- Licensed to the public under the Apache License 2.0.

local sys = require "luci.sys"
local net = require "luci.model.network".init()

map = Map("ipvs", translate("Real Server Details"), translate("VS Load Balancer: Configure Real Server Details")) -- Edit config file /etc/config/ipvs
map.redirect = luci.dispatcher.build_url("admin/network/ipvs")

function map.on_before_commit(self)
	sys.exec("/etc/init.d/ipvsadm stop")
end
function map.on_after_commit(self)
	sys.exec("/etc/init.d/ipvsadm start")
end

-- Real Server Section
rs = map:section(NamedSection, arg[1], "real", translatef("Real Server %q", arg[1]))

rip = rs:option(Value, "ipaddr", translate("IP Address"))
rip.datatype = "ip4addr"

pfw = rs:option(ListValue, "packet_forwarding", translate("Packet Forwarding"))
pfw:value("direct", "Direct Routing")
pfw:value("tunnel", "Tunneling")
pfw:value("nat", "Masquerading (NAT)")

wgt = rs:option(Value, "weight", translate("Weight"), translate("1-65535 - The capacity of a server relative to others in the pool"))
wgt.datatype = "range(1,65535)"

ut = rs:option(Value, "u_threshold", translate("Upper connection threshold"), translate("0-65535 - If > 0 no new connections will be sent when the threshold is exceeded"))
ut.datatype = "range(0,65535)"

lt = rs:option(Value, "l_threshold", translate("Lower connection threshold"), translate("0-65535 - If > 0 New connections will be sent when the total drops below the threshold"))
lt.datatype = "range(0,65535)"

ca = rs:option(ListValue, "probe_method", translate("Server probe method")) 
ca:value("ping")
ca:value("wget")

caw = rs:option(Value, "probe_url", translate("wget URL path"), translate("The URL will be composed by http://[server ip address]/path"))
caw:depends("probe_method", "wget")

return map

