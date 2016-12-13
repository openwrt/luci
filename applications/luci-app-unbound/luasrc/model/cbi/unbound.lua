-- Copyright 2008 Steven Barth <steven@midlink.org>
-- Copyright 2016 Eric Luehrsen <ericluehrsen@hotmail.com>
-- Copyright 2016 Dan Luedtke <mail@danrl.com>
-- Licensed to the public under the Apache License 2.0.

m = Map("unbound", translate("Recursive DNS"),
	translate("Unbound is a validating, recursive, and caching DNS resolver."))
	
s = m:section(TypedSection, "unbound", translate("Unbound Settings"))
s.addremove = false
s.anonymous = true

s:tab("service", translate("Unbound Service"))
s:tab("resource", translate("Unbound Resources"))
s:tab("dnsmasq", translate("Dnsmasq Link"))

--Enable Unbound

e = s:taboption("service", Flag, "enabled", translate("Enable Unbound:"),
  translate("Enable the initialization scripts for Unbound"))
e.rmempty = false

function e.cfgvalue(self, section)
	return luci.sys.init.enabled("unbound") and self.enabled or self.disabled
end

function e.write(self, section, value)
	if value == "1" then
		luci.sys.init.enable("unbound")
		luci.sys.call("/etc/init.d/unbound start >/dev/null")
	else
		luci.sys.call("/etc/init.d/unbound stop >/dev/null")
		luci.sys.init.disable("unbound")
	end

	return Flag.write(self, section, value)
end

--Service Tab

mcf = s:taboption("service", Flag, "manual_conf", translate("Manual Conf:"),
  translate("Skip UCI and use /etc/unbound/unbound.conf"))
mcf.rmempty = false

lsv = s:taboption("service", Flag, "localservice", translate("Local Service:"),
  translate("Accept queries only from local subnets"))
lsv.rmempty = false

qry = s:taboption("service", Flag, "query_minimize", translate("Query Minimize:"),
  translate("Break down query components for small added privacy"))
qry.rmempty = false

rlh = s:taboption("service", Flag, "rebind_localhost", translate("Block Localhost Rebind:"),
  translate("Prevent upstream response of 127.0.0.0/8"))
rlh.rmempty = false

rpv = s:taboption("service", Flag, "rebind_protection", translate("Block Private Rebind:"),
  translate("Prevent upstream response of RFC1918 ranges"))
rpv.rmempty = false

vld = s:taboption("service", Flag, "validator", translate("Enable DNSSEC:"),
  translate("Enable the DNSSEC validator module"))
vld.rmempty = false

nvd = s:taboption("service", Flag, "validator_ntp", translate("DNSSEC NTP Fix:"),
  translate("Break the loop where DNSSEC needs NTP and NTP needs DNS"))
nvd.rmempty = false

eds = s:taboption("service", Value, "edns_size", translate("EDNS Size:"),
  translate("Limit extended DNS packet size"))
eds.datatype = "and(uinteger,min(512),max(4096))"
eds.rmempty = false

prt = s:taboption("service", Value, "listen_port", translate("Listening Port:"),
  translate("Choose Unbounds listening port"))
prt.datatype = "port"
prt.rmempty = false

tlm = s:taboption("service", Value, "ttl_min", translate("TTL Minimum:"),
  translate("Prevent excessively short cache periods"))
tlm.datatype = "and(uinteger,min(0),max(600))"
tlm.rmempty = false

d64 = s:taboption("service", Flag, "dns64", translate("Enable DNS64:"),
  translate("Enable the DNS64 module"))
d64.rmempty = false

pfx = s:taboption("service", Value, "dns64_prefix", translate("DNS64 Prefix:"),
  translate("Prefix for generated DNS64 addresses"))
pfx.datatype = "ip6addr"
pfx.placeholder = "64:ff9b::/96"
pfx.optional = true
pfx:depends({ dns64 = "1" })

--Resource Tuning Tab

rsn = s:taboption("resource", ListValue, "recursion", translate("Recursion Strength:"),
  translate("Recursion activity affects memory growth and CPU load"))
rsn:value("aggressive", translate("Aggressive"))
rsn:value("default", translate("Default"))
rsn:value("passive", translate("Passive"))
rsn.rmempty = false

rsc = s:taboption("resource", ListValue, "resource", translate("Memory Resource:"),
  translate("Use menu System/Processes to observe any memory growth"))
rsc:value("large", translate("Large"))
rsc:value("medium", translate("Medium"))
rsc:value("small", translate("Small"))
rsc:value("tiny", translate("Tiny"))
rsc.rmempty = false

age = s:taboption("resource", Value, "root_age", translate("Root DSKEY Age:"),
  translate("Limit days between RFC5011 to reduce flash writes"))
age.datatype = "and(uinteger,min(1),max(99))"
age:value("14", "14")
age:value("28", "28 ("..translate("default")..")")
age:value("45", "45")
age:value("90", "90")
age:value("99", "99 ("..translate("never")..")")

--Dnsmasq Link Tab

dld = s:taboption("dnsmasq", Flag, "dnsmasq_link_dns", translate("Link dnsmasq:"),
  translate("Forward queries to dnsmasq for local clients"))
dld.rmempty = false

dgn = s:taboption("dnsmasq", Flag, "dnsmsaq_gate_name", translate("Local Gateway Name:"),
  translate("Also query dnsmasq for this hosts outbound gateway"))
dgn.rmempty = false

--TODO: Read only repective dnsmasq options and inform user of link requirements.
--TODO: dnsmasq needs to not reference resolve-file and get off port 53.

return m

