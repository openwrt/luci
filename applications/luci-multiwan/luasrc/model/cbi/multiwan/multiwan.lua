require("luci.tools.webadmin")

m = Map("multiwan", translate("Multi-WAN"),
	translate("Multi-WAN allows for the use of multiple uplinks for load balancing and failover."))

s = m:section(NamedSection, "config", "multiwan", "")

e = s:option(Flag, "enabled", translate("Enable"))
e.rmempty = false
e.default = e.enabled

function e.write(self, section, value)
	if value == "0" then
		os.execute("/etc/init.d/multiwan stop")
	else
		os.execute("/etc/init.d/multiwan enable")
	end
	Flag.write(self, section, value)
end

s = m:section(TypedSection, "interface", translate("WAN Interfaces"),
	translate("Health Monitor detects and corrects network changes and failed connections."))
s.addremove = true

weight = s:option(ListValue, "weight", translate("Load Balancer Distribution"))
weight:value("10", "10")
weight:value("9", "9")
weight:value("8", "8")
weight:value("7", "7")
weight:value("6", "6")
weight:value("5", "5")
weight:value("4", "4")
weight:value("3", "3")
weight:value("2", "2")
weight:value("1", "1")
weight:value("disable", translate("None"))
weight.default = "10"
weight.optional = false
weight.rmempty = false

interval = s:option(ListValue, "health_interval", translate("Health Monitor Interval"))
interval:value("disable", translate("Disable"))
interval:value("5", "5 sec.")
interval:value("10", "10 sec.")
interval:value("20", "20 sec.")
interval:value("30", "30 sec.")
interval:value("60", "60 sec.")
interval:value("120", "120 sec.")
interval.default = "10"
interval.optional = false
interval.rmempty = false

icmp_hosts = s:option(Value, "icmp_hosts", translate("Health Monitor ICMP Host(s)"))
icmp_hosts:value("disable", translate("Disable"))
icmp_hosts:value("dns", "DNS Server(s)")
icmp_hosts:value("gateway", "WAN Gateway")
icmp_hosts.default = "dns"
icmp_hosts.optional = false
icmp_hosts.rmempty = false

timeout = s:option(ListValue, "timeout", translate("Health Monitor ICMP Timeout"))
timeout:value("1", "1 sec.")
timeout:value("2", "2 sec.")
timeout:value("3", "3 sec.")
timeout:value("4", "4 sec.")
timeout:value("5", "5 sec.")
timeout:value("10", "10 sec.")
timeout.default = "3"
timeout.optional = false
timeout.rmempty = false

fail = s:option(ListValue, "health_fail_retries", translate("Attempts Before WAN Failover"))
fail:value("1", "1")
fail:value("3", "3")
fail:value("5", "5")
fail:value("10", "10")
fail:value("15", "15")
fail:value("20", "20")
fail.default = "3"
fail.optional = false
fail.rmempty = false

recovery = s:option(ListValue, "health_recovery_retries", translate("Attempts Before WAN Recovery"))
recovery:value("1", "1")
recovery:value("3", "3")
recovery:value("5", "5")
recovery:value("10", "10")
recovery:value("15", "15")
recovery:value("20", "20")
recovery.default = "5"
recovery.optional = false
recovery.rmempty = false

failover_to = s:option(ListValue, "failover_to", translate("Failover Traffic Destination"))
failover_to:value("disable", translate("None"))
luci.tools.webadmin.cbi_add_networks(failover_to)
failover_to:value("fastbalancer", translate("Load Balancer(Performance)"))
failover_to:value("balancer", translate("Load Balancer(Compatibility)"))
failover_to.default = "balancer"
failover_to.optional = false
failover_to.rmempty = false

dns = s:option(Value, "dns", translate("DNS Server(s)"))
dns:value("auto", translate("Auto"))
dns.default = "auto"
dns.optional = false
dns.rmempty = true

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
