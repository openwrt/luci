-- Copyright 2008 Steven Barth <steven@midlink.org>
-- Copyright 2016 Eric Luehrsen <ericluehrsen@hotmail.com>
-- Copyright 2016 Dan Luedtke <mail@danrl.com>
-- Licensed to the public under the Apache License 2.0.

m = Map("unbound", translate("Recursive DNS"),
	translate("Unbound is a validating, recursive, and caching DNS resolver."))

s1 = m:section(TypedSection, "unbound")
s1.addremove = false
s1.anonymous = true
s1:tab("service", translate("Basic Settings"))
s1:tab("advanced", translate("Advanced Settings"))
s1:tab("resource", translate("Resource Settings"))

--LuCI or Not

ena = s1:taboption("service", Flag, "enabled", translate("Enable Unbound:"),
  translate("Enable the initialization scripts for Unbound"))
ena.rmempty = false

mcf = s1:taboption("service", Flag, "manual_conf", translate("Manual Conf:"),
  translate("Skip UCI and use /etc/unbound/unbound.conf"))
mcf.rmempty = false

function ena.cfgvalue(self, section)
	return luci.sys.init.enabled("unbound") and self.enabled or self.disabled
end

function ena.write(self, section, value)
	if value == "1" then
		luci.sys.init.enable("unbound")
		luci.sys.call("/etc/init.d/unbound start >/dev/null")
	else
		luci.sys.call("/etc/init.d/unbound stop >/dev/null")
		luci.sys.init.disable("unbound")
	end

	return Flag.write(self, section, value)
end

--Basic Tab

lsv = s1:taboption("service", Flag, "localservice", translate("Local Service:"),
  translate("Accept queries only from local subnets"))
lsv.rmempty = false

rlh = s1:taboption("service", Flag, "rebind_localhost", translate("Block Localhost Rebind:"),
  translate("Prevent upstream response of 127.0.0.0/8"))
rlh.rmempty = false

rpv = s1:taboption("service", Flag, "rebind_protection", translate("Block Private Rebind:"),
  translate("Prevent upstream response of RFC1918 ranges"))
rpv.rmempty = false

vld = s1:taboption("service", Flag, "validator", translate("Enable DNSSEC:"),
  translate("Enable the DNSSEC validator module"))
vld.rmempty = false

nvd = s1:taboption("service", Flag, "validator_ntp", translate("DNSSEC NTP Fix:"),
  translate("Break the loop where DNSSEC needs NTP and NTP needs DNS"))
nvd.rmempty = false
nvd:depends({ validator = true })

eds = s1:taboption("service", Value, "edns_size", translate("EDNS Size:"),
  translate("Limit extended DNS packet size"))
eds.datatype = "and(uinteger,min(512),max(4096))"
eds.rmempty = false

prt = s1:taboption("service", Value, "listen_port", translate("Listening Port:"),
  translate("Choose Unbounds listening port"))
prt.datatype = "port"
prt.rmempty = false

tlm = s1:taboption("service", Value, "ttl_min", translate("TTL Minimum:"),
  translate("Prevent excessively short cache periods"))
tlm.datatype = "and(uinteger,min(0),max(600))"
tlm.rmempty = false

--Advanced Tab

ctl = s1:taboption("advanced", Flag, "unbound_control", translate("Unbound Control App:"),
  translate("Enable unecrypted localhost access for unbound-control"))
ctl.rmempty = false

dlk = s1:taboption("advanced", ListValue, "dhcp_link", translate("DHCP Link:"),
  translate("Link to supported programs to load DHCP into DNS"))
dlk:value("none", translate("No Link"))
dlk:value("dnsmasq", "dnsmasq")
dlk:value("odhcpd", "odhcpd")
dlk.rmempty = false

dom = s1:taboption("advanced", Value, "domain", translate("Local Domain:"),
  translate("Domain suffix for this router and DHCP clients"))
dom.placeholder = "lan"
dom:depends({ dhcp_link = "none" })
dom:depends({ dhcp_link = "odhcpd" })

dty = s1:taboption("advanced", ListValue, "domain_type", translate("Local Domain Type:"),
  translate("How to treat queries of this local domain"))
dty:value("deny", translate("Ignored"))
dty:value("refuse", translate("Refused"))
dty:value("static", translate("Only Local"))
dty:value("transparent", translate("Also Forwarded"))
dty:depends({ dhcp_link = "none" })
dty:depends({ dhcp_link = "odhcpd" })

lfq = s1:taboption("advanced", ListValue, "add_local_fqdn", translate("LAN DNS:"),
  translate("How to enter the LAN or local network router in DNS"))
lfq:value("0", translate("No DNS"))
lfq:value("1", translate("Hostname, Primary Address"))
lfq:value("2", translate("Hostname, All Addresses"))
lfq:value("3", translate("Host FQDN, All Addresses"))
lfq:value("4", translate("Interface FQDN, All Addresses"))
lfq:depends({ dhcp_link = "none" })
lfq:depends({ dhcp_link = "odhcpd" })

wfq = s1:taboption("advanced", ListValue, "add_wan_fqdn", translate("WAN DNS:"),
  translate("Override the WAN side router entry in DNS"))
wfq:value("0", translate("Upstream"))
wfq:value("1", translate("Hostname, Primary Address"))
wfq:value("2", translate("Hostname, All Addresses"))
wfq:value("3", translate("Host FQDN, All Addresses"))
wfq:value("4", translate("Interface FQDN, All Addresses"))
wfq:depends({ dhcp_link = "none" })
wfq:depends({ dhcp_link = "odhcpd" })

ctl = s1:taboption("advanced", Flag, "dhcp4_slaac6", translate("DHCPv4 to SLAAC:"),
  translate("Use DHCPv4 MAC to discover IP6 hosts SLAAC (EUI64)"))
ctl.rmempty = false

d64 = s1:taboption("advanced", Flag, "dns64", translate("Enable DNS64:"),
  translate("Enable the DNS64 module"))
d64.rmempty = false

pfx = s1:taboption("advanced", Value, "dns64_prefix", translate("DNS64 Prefix:"),
  translate("Prefix for generated DNS64 addresses"))
pfx.datatype = "ip6addr"
pfx.placeholder = "64:ff9b::/96"
pfx.optional = true
pfx:depends({ dns64 = true })

qry = s1:taboption("advanced", Flag, "query_minimize", translate("Query Minimize:"),
  translate("Break down query components for limited added privacy"))
qry.rmempty = false

qrs = s1:taboption("advanced", Flag, "query_min_strict", translate("Strict Minimize:"),
  translate("Strict version of 'query minimize' but it can break DNS"))
qrs.rmempty = false
qrs:depends({ query_minimize = true })

--TODO: dnsmasq needs to not reference resolve-file and get off port 53.

--Resource Tuning Tab

pro = s1:taboption("resource", ListValue, "protocol", translate("Recursion Protocol:"),
  translate("Chose the protocol recursion queries leave on"))
pro:value("mixed", translate("IP4 and IP6"))
pro:value("ip6_prefer", translate("IP6 Preferred"))
pro:value("ip4_only", translate("IP4 Only"))
pro:value("ip6_only", translate("IP6 Only"))
pro.rmempty = false

rsn = s1:taboption("resource", ListValue, "recursion", translate("Recursion Strength:"),
  translate("Recursion activity affects memory growth and CPU load"))
rsn:value("aggressive", translate("Aggressive"))
rsn:value("default", translate("Default"))
rsn:value("passive", translate("Passive"))
rsn.rmempty = false

rsc = s1:taboption("resource", ListValue, "resource", translate("Memory Resource:"),
  translate("Use menu System/Processes to observe any memory growth"))
rsc:value("large", translate("Large"))
rsc:value("medium", translate("Medium"))
rsc:value("small", translate("Small"))
rsc:value("tiny", translate("Tiny"))
rsc.rmempty = false

ag2 = s1:taboption("resource", Value, "root_age", translate("Root DSKEY Age:"),
  translate("Limit days between RFC5011 to reduce flash writes"))
ag2.datatype = "and(uinteger,min(1),max(99))"
ag2:value("14", "14")
ag2:value("28", "28 ("..translate("default")..")")
ag2:value("45", "45")
ag2:value("90", "90")
ag2:value("99", "99 ("..translate("never")..")")

return m

