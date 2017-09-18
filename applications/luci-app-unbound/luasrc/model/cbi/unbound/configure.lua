-- Copyright 2008 Steven Barth <steven@midlink.org>
-- Copyright 2016 Eric Luehrsen <ericluehrsen@hotmail.com>
-- Copyright 2016 Dan Luedtke <mail@danrl.com>
-- Licensed to the public under the Apache License 2.0.

local m1, s1
local ena, mcf, lci, lsv, rlh, rpv, vld, nvd, eds, prt, tlm
local ctl, dlk, dom, dty, lfq, wfq, exa, dp6, d64, pfx, qry, qrs
local pro, tgr, rsc, rsn, ag2, stt
local ucl = luci.model.uci.cursor()
local valman = ucl:get_first("unbound", "unbound", "manual_conf")

m1 = Map("unbound")

s1 = m1:section(TypedSection, "unbound")
s1.addremove = false
s1.anonymous = true

--LuCI, Unbound, or Not
s1:tab("basic", translate("Basic"),
  translatef("<h3>Unbound Basic Settings</h3>\n"
  .. "<a href=\"%s\" target=\"_blank\">Unbound</a>"
  .. " is a validating, recursive, and caching DNS resolver. "
  .. "UCI help can be found on "
  .. "<a href=\"%s\" target=\"_blank\">github</a>.",
  "https://www.unbound.net/",
  "https://github.com/openwrt/packages/blob/master/net/unbound/files/README.md"))

ena = s1:taboption("basic", Flag, "enabled", translate("Enable Unbound:"),
  translate("Enable the initialization scripts for Unbound"))
ena.rmempty = false

mcf = s1:taboption("basic", Flag, "manual_conf", translate("Manual Conf:"),
  translate("Skip UCI and use /etc/unbound/unbound.conf"))
mcf.rmempty = false

lci = s1:taboption("basic", Flag, "extended_luci", translate("Advanced LuCI:"),
  translate("See detailed tabs for debug and advanced manual configuration"))
lci.rmempty = false


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


if valman ~= "1" then
  -- Not in manual configuration mode; show UCI
  s1:tab("advanced", translate("Advanced"),
    translatef("<h3>Unbound Advanced Settings</h3>\n"
    .. "Advanced setttings and plugin modules for "
    .. "<a href=\"%s\" target=\"_blank\">Unbound</a>"
    .. " DNS resolver.", "https://www.unbound.net/"))

  s1:tab("resource", translate("Resource"),
    translatef("<h3>Unbound Resource Settings</h3>\n"
    .. "Memory and protocol setttings for "
    .. "<a href=\"%s\" target=\"_blank\">Unbound</a>"
    .. " DNS resolver.", "https://www.unbound.net/"))

  --Basic Tab
  lsv = s1:taboption("basic", Flag, "localservice", translate("Local Service:"),
    translate("Accept queries only from local subnets"))
  lsv.rmempty = false

  rlh = s1:taboption("basic", Flag, "rebind_localhost", translate("Block Localhost Rebind:"),
    translate("Prevent upstream response of 127.0.0.0/8"))
  rlh.rmempty = false

  rpv = s1:taboption("basic", Flag, "rebind_protection", translate("Block Private Rebind:"),
    translate("Prevent upstream response of RFC1918 ranges"))
  rpv.rmempty = false

  vld = s1:taboption("basic", Flag, "validator", translate("Enable DNSSEC:"),
    translate("Enable the DNSSEC validator module"))
  vld.rmempty = false

  nvd = s1:taboption("basic", Flag, "validator_ntp", translate("DNSSEC NTP Fix:"),
    translate("Break the loop where DNSSEC needs NTP and NTP needs DNS"))
  nvd.rmempty = false
  nvd:depends({ validator = true })

  eds = s1:taboption("basic", Value, "edns_size", translate("EDNS Size:"),
    translate("Limit extended DNS packet size"))
  eds.datatype = "and(uinteger,min(512),max(4096))"
  eds.rmempty = false

  prt = s1:taboption("basic", Value, "listen_port", translate("Listening Port:"),
    translate("Choose Unbounds listening port"))
  prt.datatype = "port"
  prt.rmempty = false

  tlm = s1:taboption("basic", Value, "ttl_min", translate("TTL Minimum:"),
    translate("Prevent excessively short cache periods"))
  tlm.datatype = "and(uinteger,min(0),max(600))"
  tlm.rmempty = false

  --Advanced Tab
  ctl = s1:taboption("advanced", ListValue, "unbound_control", translate("Unbound Control App:"),
    translate("Enable access for unbound-control"))
  ctl.rmempty = false
  ctl:value("0", translate("No Remote Control"))
  ctl:value("1", translate("Local Host, No Encryption"))
  ctl:value("2", translate("Local Host, Encrypted"))
  ctl:value("3", translate("Local Subnet, Encrypted"))
  ctl:value("4", translate("Local Subnet, Static Encryption"))

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

  exa = s1:taboption("advanced", ListValue, "add_extra_dns", translate("Extra DNS:"),
    translate("Use extra DNS entries found in /etc/config/dhcp"))
  exa:value("0", translate("Ignore"))
  exa:value("1", translate("Include Network/Hostnames"))
  exa:value("2", translate("Advanced MX/SRV RR"))
  exa:value("3", translate("Advanced CNAME RR"))
  exa:depends({ dhcp_link = "none" })
  exa:depends({ dhcp_link = "odhcpd" })

  dp6 = s1:taboption("advanced", Flag, "dhcp4_slaac6", translate("DHCPv4 to SLAAC:"),
    translate("Use DHCPv4 MAC to discover IP6 hosts SLAAC (EUI64)"))
  dp6.rmempty = false

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
  ag2:value("3", "3")
  ag2:value("9", "9 ("..translate("default")..")")
  ag2:value("12", "12")
  ag2:value("24", "24")
  ag2:value("99", "99 ("..translate("never")..")")

  stt = s1:taboption("resource", Flag, "extended_stats", translate("Extended Statistics:"),
    translate("Extended statistics are printed from unbound-control"))
  stt.rmempty = false

  tgr = s1:taboption("resource", Value, "trigger", translate("Trigger Networks:"),
    translate("Networks that may trigger Unbound to reload (avoid wan6)"))
  tgr.template = "cbi/network_netlist"
  tgr.widget = "checkbox"
  tgr.cast = "string"

else
  s1:tab("rfc5011", translate("RFC5011"),
    translatef("<h3>Unbound RFC5011 Settings</h3>\n"
    .. "RFC5011 copy scripts protect flash ROM even with UCI disabled."))

  ag2 = s1:taboption("rfc5011", Value, "root_age", translate("Root DSKEY Age:"),
    translate("Limit days to copy /var/->/etc/ to reduce flash writes"))
  ag2.datatype = "and(uinteger,min(1),max(99))"
  ag2:value("3", "3")
  ag2:value("9", "9 ("..translate("default")..")")
  ag2:value("12", "12")
  ag2:value("24", "24")
  ag2:value("99", "99 ("..translate("never")..")")
end


function m1.on_after_commit(self)
  function ena.validate(self, value)
    if value ~= "0" then
      luci.sys.call("/etc/init.d/unbound restart >/dev/null 2>&1")
    else
      luci.sys.call("/etc/init.d/unbound stop >/dev/null 2>&1")
    end
  end


  -- Restart Unbound with configuration and reload the page (some options hide)
  luci.http.redirect(luci.dispatcher.build_url("admin", "services", "unbound"))
end


return m1

