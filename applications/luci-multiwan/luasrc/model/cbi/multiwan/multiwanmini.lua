require("luci.tools.webadmin")

m = Map("multiwan", translate("Multi-WAN"),
	translate("Multi-WAN allows for the use of multiple uplinks for load balancing and failover."))

s = m:section(NamedSection, "config", "multiwan", "")

e = s:option(Flag, "enabled", translate("Enable"))
e.rmempty = false
e.default = "1"

function e.write(self, section, value)
	if value == "0" then
		os.execute("/etc/init.d/multiwan stop")
	else
		os.execute("/etc/init.d/multiwan enable")
	end
	Flag.write(self, section, value)
end

s = m:section(TypedSection, "mwanfw", translate("Multi-WAN Traffic Rules"),
	translate("Configure rules for directing outbound traffic through specified WAN Uplinks."))
s.template = "cbi/tblsection"
s.anonymous = true
s.addremove = true

src = s:option(Value, "src", translate("Source Address"))
src.rmempty = true
src:value("", translate("all"))
luci.tools.webadmin.cbi_add_knownips(src)

dst = s:option(Value, "dst", translate("Destination Address"))
dst.rmempty = true
dst:value("", translate("all"))
luci.tools.webadmin.cbi_add_knownips(dst)

proto = s:option(Value, "proto", translate("Protocol"))
proto:value("", translate("all"))
proto:value("tcp", "TCP")
proto:value("udp", "UDP")
proto:value("icmp", "ICMP")
proto.rmempty = true

ports = s:option(Value, "ports", translate("Ports"))
ports.rmempty = true
ports:value("", translate("all", translate("all")))

wanrule = s:option(ListValue, "wanrule", translate("WAN Uplink"))
luci.tools.webadmin.cbi_add_networks(wanrule)
wanrule:value("fastbalancer", translate("Load Balancer(Performance)"))
wanrule:value("balancer", translate("Load Balancer(Compatibility)"))
wanrule.default = "fastbalancer"
wanrule.optional = false
wanrule.rmempty = false

s = m:section(NamedSection, "config", "", "")
s.addremove = false

default_route = s:option(ListValue, "default_route", translate("Default Route"))
luci.tools.webadmin.cbi_add_networks(default_route)
default_route:value("fastbalancer", translate("Load Balancer(Performance)"))
default_route:value("balancer", translate("Load Balancer(Compatibility)"))
default_route.default = "balancer"
default_route.optional = false
default_route.rmempty = false

return m
