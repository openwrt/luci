require("luci.tools.webadmin")
m = Map("multiwan")

s = m:section(NamedSection, "config", "multiwan", "")
e = s:option(Flag, "enabled", translate("enable"))
e.rmempty = false

function e.write(self, section, value)
        local cmd = (value == "1") and "enable" or "disable"
        if value ~= "1" then
                os.execute("/etc/init.d/multiwan stop")
        end
        os.execute("/etc/init.d/multiwan " .. cmd)
end

function e.cfgvalue(self, section)
        return (os.execute("/etc/init.d/multiwan enabled") == 0) and "1" or "0"
end

default_route = s:option(ListValue, "default_route", translate("default_route"))
luci.tools.webadmin.cbi_add_networks(default_route)
default_route:value("balancer", translate("balancer"))
default_route.default = "balancer"
default_route.optional = false
default_route.rmempty = false

resolv_conf = s:option(Value, "resolv_conf", translate("resolv_conf"), translate("resolv_conf_desc"))
resolv_conf.default = "/tmp/resolv.conf.auto"
resolv_conf.optional = false
resolv_conf.rmempty = false

s = m:section(TypedSection, "interface", translate("interfaces"), translate("interfaces_desc"))
s.addremove = true

weight = s:option(ListValue, "weight", translate("weight"))
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
weight:value("disable", translate("none"))
weight.default = "5"
weight.optional = false
weight.rmempty = false

interval = s:option(ListValue, "health_interval", translate("health_interval"))
interval:value("disable", translate("disable"))
interval:value("5", "5 sec.")
interval:value("10", "10 sec.")
interval:value("20", "20 sec.")
interval:value("30", "30 sec.")
interval:value("60", "60 sec.")
interval:value("120", "120 sec.")
interval.default = "10"
interval.optional = false
interval.rmempty = false

icmp_hosts = s:option(Value, "icmp_hosts", translate("icmp_hosts"))
icmp_hosts:value("disable", translate("disable"))
icmp_hosts:value("dns", "DNS Server(s)")
icmp_hosts:value("gateway", "WAN Gateway")
icmp_hosts.default = "dns"
icmp_hosts.optional = false
icmp_hosts.rmempty = false

timeout = s:option(ListValue, "timeout", translate("timeout"))
timeout:value("1", "1 sec.")
timeout:value("2", "2 sec.")
timeout:value("3", "3 sec.")
timeout:value("4", "4 sec.")
timeout:value("5", "5 sec.")
timeout:value("10", "10 sec.")
timeout.default = "3"
timeout.optional = false
timeout.rmempty = false

fail = s:option(ListValue, "health_fail_retries", translate("health_fail_retries"))
fail:value("1", "1")
fail:value("3", "3")
fail:value("5", "5")
fail:value("10", "10")
fail:value("15", "15")
fail:value("20", "20")
fail.default = "3"
fail.optional = false
fail.rmempty = false

recovery = s:option(ListValue, "health_recovery_retries", translate("health_recovery_retries"))
recovery:value("1", "1")
recovery:value("3", "3")
recovery:value("5", "5")
recovery:value("10", "10")
recovery:value("15", "15")
recovery:value("20", "20")
recovery.default = "5"
recovery.optional = false
recovery.rmempty = false

failover_to = s:option(ListValue, "failover_to", translate("failover_to"))
failover_to:value("disable", translate("none"))
luci.tools.webadmin.cbi_add_networks(failover_to)
failover_to:value("balancer", translate("balancer"))
failover_to.default = "balancer"
failover_to.optional = false
failover_to.rmempty = false

s = m:section(TypedSection, "mwanfw", translate("mwanfw"), translate("mwanfw_desc"))
s.template = "cbi/tblsection"
s.anonymous = true
s.addremove = true

src = s:option(Value, "src", translate("src"))
src.rmempty = true
src:value("", translate("all"))
luci.tools.webadmin.cbi_add_knownips(src)

dst = s:option(Value, "dst", translate("dst"))
dst.rmempty = true
dst:value("", translate("all"))
luci.tools.webadmin.cbi_add_knownips(dst)

proto = s:option(ListValue, "proto", translate("protocol"))
proto:value("", translate("all"))
proto:value("tcp", "TCP")
proto:value("udp", "UDP")
proto:value("icmp", "ICMP")
proto.rmempty = true

ports = s:option(Value, "ports", translate("ports"))
ports.rmempty = true
ports:value("", translate("all", translate("all")))

wanrule = s:option(ListValue, "wanrule", translate("wanrule"))
luci.tools.webadmin.cbi_add_networks(wanrule)
wanrule:value("balancer", translate("balancer"))
wanrule.default = "balancer"
wanrule.optional = false
wanrule.rmempty = false

return m
