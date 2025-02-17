-- Copyright 2008 Steven Barth <steven@midlink.org>
-- Copyright 2016 Eric Luehrsen <ericluehrsen@gmail.com>
-- Copyright 2016 Dan Luedtke <mail@danrl.com>
-- Licensed to the public under the Apache License 2.0.

local m1, s1
local ena, mcf, lci, lsv
local rlh, rpv, vld, nvd, eds, prt, tlm
local ctl, dlk, dom, dty, lfq, wfq, exa
local dp6, d64, pfx, qry, qrs
local pro, rsc, rsn, ag2, stt
local tgr, ifc, wfc
local rpn, din, ath

local ut = require "luci.util"
local sy = require "luci.sys"
local ht = require "luci.http"
local ds = require "luci.dispatcher"
local ucl = luci.model.uci.cursor()
local valman = ucl:get_first("unbound", "unbound", "manual_conf")
local dhcplk = ucl:get_first("unbound", "unbound", "dhcp_link")
local lstrig = ucl:get_first("dhcp", "odhcpd", "leasetrigger") or "undefined"

m1 = Map("unbound")
s1 = m1:section(TypedSection, "unbound", translate("Recursive DNS"),
    translatef("Unbound <a href=\"%s\" target=\"_blank\">(NLnet Labs)</a>"
    .. " is a validating, recursive, and caching DNS resolver"
    .. " <a href=\"%s\" target=\"_blank\">(help)</a>.",
    "https://www.unbound.net/",
    "https://github.com/openwrt/packages/blob/master/net/unbound/files/README.md"))

s1.addremove = false
s1.anonymous = true

if (valman == "0") and (dhcplk == "odhcpd") and (lstrig ~= "/usr/lib/unbound/odhcpd.sh") then
    m1.message = translatef( "Note: local DNS is configured to look at odhpcd, "
    .. "but odhpcd UCI lease trigger is incorrectly set: ")
    .. "dhcp.odhcpd.leasetrigger='" .. lstrig .. "'"
end

--LuCI, Unbound, or Not
s1:tab("basic", translate("Basic"))


if (valman == "0") then
    -- Not in manual configuration mode; show UCI
    s1:tab("advanced", translate("Advanced"))
    s1:tab("DHCP", translate("DHCP"))
    s1:tab("resource", translate("Resource"))
end


--Basic Tab, unconditional pieces
ena = s1:taboption("basic", Flag, "enabled", translate("Enable Unbound"),
    translate("Enable the initialization scripts for Unbound"))
ena.rmempty = false

mcf = s1:taboption("basic", Flag, "manual_conf", translate("Manual Conf"),
    translate("Skip UCI and use /etc/unbound/unbound.conf"))
mcf.rmempty = false


if (valman == "0") then
    -- Not in manual configuration mode; show UCI
    --Basic Tab
    lsv = s1:taboption("basic", Flag, "localservice",
        translate("Local Service"),
        translate("Accept queries only from local subnets"))
    lsv.rmempty = false

    vld = s1:taboption("basic", Flag, "validator",
        translate("Enable DNSSEC"),
        translate("Enable the DNSSEC validator module"))
    vld.rmempty = false

    nvd = s1:taboption("basic", Flag, "validator_ntp",
        translate("DNSSEC NTP Fix"),
        translate("Break the loop where DNSSEC needs NTP and NTP needs DNS"))
    nvd.optional = true
    nvd.default = true
    nvd:depends("validator", true)

    prt = s1:taboption("basic", Value, "listen_port",
        translate("Listening Port"),
        translate("Choose Unbounds listening port"))
    prt.datatype = "port"
    prt.placeholder = "53"

    --Avanced Tab
    rlh = s1:taboption("advanced", Flag, "rebind_localhost",
        translate("Filter Localhost Rebind"),
        translate("Protect against upstream response of 127.0.0.0/8"))
    rlh.rmempty = false

    rpv = s1:taboption("advanced", ListValue, "rebind_protection",
        translate("Filter Private Rebind"),
        translate("Protect against upstream responses within local subnets"))
    rpv:value("0", translate("No Filter"))
    rpv:value("1", translate("Filter Private Address"))
    rpv:value("2", translate("Filter Entire Subnet"))
    rpv.rmempty = false

    d64 = s1:taboption("advanced", Flag, "dns64", translate("Enable DNS64"),
        translate("Enable the DNS64 module"))
    d64.rmempty = false

    pfx = s1:taboption("advanced", Value, "dns64_prefix",
        translate("DNS64 Prefix"),
        translate("Prefix for generated DNS64 addresses"))
    pfx.datatype = "ip6addr"
    pfx.placeholder = "64:ff9b::/96"
    pfx.optional = true
    pfx:depends("dns64", true)

    din = s1:taboption("advanced", DynamicList, "domain_insecure",
        translate("Domain Insecure"),
        translate("List domains to bypass checks of DNSSEC"))
    din:depends("validator", true)

    ag2 = s1:taboption("advanced", Value, "root_age",
        translate("Root DSKEY Age"),
        translate("Limit days between RFC5011 copies to reduce flash writes"))
    ag2.datatype = "and(uinteger,min(1),max(99))"
    ag2:value("3", "3")
    ag2:value("9", "9 ("..translate("default")..")")
    ag2:value("12", "12")
    ag2:value("24", "24")
    ag2:value("99", "99 ("..translate("never")..")")

    ifc = s1:taboption("advanced", Value, "iface_lan",
        translate("LAN Networks"),
        translate("Networks to consider LAN (served) beyond those served by DHCP"))
    ifc.template = "cbi/network_netlist"
    ifc.widget = "checkbox"
    ifc.rmempty = true
    ifc.cast = "string"
    ifc.nocreate = true

    wfc = s1:taboption("advanced", Value, "iface_wan",
        translate("WAN Networks"),
        translate("Networks to consider WAN (unserved)"))
    wfc.template = "cbi/network_netlist"
    wfc.widget = "checkbox"
    wfc.rmempty = true
    wfc.cast = "string"
    wfc.nocreate = true

    tgr = s1:taboption("advanced", Value, "iface_trig",
        translate("Trigger Networks"),
        translate("Networks that may trigger Unbound to reload (avoid wan6)"))
    tgr.template = "cbi/network_netlist"
    tgr.widget = "checkbox"
    tgr.rmempty = true
    tgr.cast = "string"
    tgr.nocreate = true

    --DHCP Tab
    dlk = s1:taboption("DHCP", ListValue, "dhcp_link",
        translate("DHCP Link"),
        translate("Link to supported programs to load DHCP into DNS"))
    dlk:value("none", translate("(none)"))
    dlk:value("dnsmasq", "dnsmasq")
    dlk:value("odhcpd", "odhcpd")
    dlk.rmempty = false

    dp6 = s1:taboption("DHCP", Flag, "dhcp4_slaac6",
        translate("DHCPv4 to SLAAC"),
        translate("Use DHCPv4 MAC to discover IP6 hosts SLAAC (EUI64)"))
    dp6.optional = true
    dp6:depends("dhcp_link", "odhcpd")

    dom = s1:taboption("DHCP", Value, "domain",
        translate("Local Domain"),
        translate("Domain suffix for this router and DHCP clients"))
    dom.placeholder = "lan"
    dom.optional = true

    dty = s1:taboption("DHCP", ListValue, "domain_type",
        translate("Local Domain Type"),
        translate("How to treat queries of this local domain"))
    dty.optional = true
    dty:value("deny", translate("Denied (nxdomain)"))
    dty:value("refuse", translate("Refused"))
    dty:value("static", translate("Static (local only)"))
    dty:value("transparent", translate("Transparent (local/global)"))
    dty:depends("dhcp_link", "none")
    dty:depends("dhcp_link", "odhcpd")

    lfq = s1:taboption("DHCP", ListValue, "add_local_fqdn",
        translate("LAN DNS"),
        translate("How to enter the LAN or local network router in DNS"))
    lfq.optional = true
    lfq:value("0", translate("No Entry"))
    lfq:value("1", translate("Hostname, Primary Address"))
    lfq:value("2", translate("Hostname, All Addresses"))
    lfq:value("3", translate("Host FQDN, All Addresses"))
    lfq:value("4", translate("Interface FQDN, All Addresses"))
    lfq:depends("dhcp_link", "none")
    lfq:depends("dhcp_link", "odhcpd")

    wfq = s1:taboption("DHCP", ListValue, "add_wan_fqdn",
        translate("WAN DNS"),
        translate("Override the WAN side router entry in DNS"))
    wfq.optional = true
    wfq:value("0", translate("Use Upstream"))
    wfq:value("1", translate("Hostname, Primary Address"))
    wfq:value("2", translate("Hostname, All Addresses"))
    wfq:value("3", translate("Host FQDN, All Addresses"))
    wfq:value("4", translate("Interface FQDN, All Addresses"))
    wfq:depends("dhcp_link", "none")
    wfq:depends("dhcp_link", "odhcpd")

    exa = s1:taboption("DHCP", ListValue, "add_extra_dns",
        translate("Extra DNS"),
        translate("Use extra DNS entries found in /etc/config/dhcp"))
    exa.optional = true
    exa:value("0", translate("Ignore"))
    exa:value("1", translate("Host Records"))
    exa:value("2", translate("Host/MX/SRV RR"))
    exa:value("3", translate("Host/MX/SRV/CNAME RR"))
    exa:depends("dhcp_link", "none")
    exa:depends("dhcp_link", "odhcpd")

    --TODO: dnsmasq needs to not reference resolve-file and get off port 53.

    --Resource Tuning Tab
    ctl = s1:taboption("resource", ListValue, "unbound_control",
        translate("Unbound Control App"),
        translate("Enable access for unbound-control"))
    ctl.rmempty = false
    ctl:value("0", translate("No Remote Control"))
    ctl:value("1", translate("Local Host, No Encryption"))
    ctl:value("2", translate("Local Host, Encrypted"))
    ctl:value("3", translate("Local Subnet, Encrypted"))
    ctl:value("4", translate("Local Subnet, Static Encryption"))

    pro = s1:taboption("resource", ListValue, "protocol",
        translate("Recursion Protocol"),
        translate("Choose the IP versions used upstream and downstream"))
    pro:value("default", translate("Default"))
    pro:value("ip4_only", translate("IP4 Only"))
    pro:value("ip6_local", translate("IP4 All and IP6 Local"))
    pro:value("ip6_only", translate("IP6 Only*"))
    pro:value("ip6_prefer", translate("IP6 Preferred"))
    pro:value("mixed", translate("IP4 and IP6"))
    pro.rmempty = false

    rsc = s1:taboption("resource", ListValue, "resource",
        translate("Memory Resource"),
        translate("Use menu System/Processes to observe any memory growth"))
    rsc:value("default", translate("Default"))
    rsc:value("tiny", translate("Tiny"))
    rsc:value("small", translate("Small"))
    rsc:value("medium", translate("Medium"))
    rsc:value("large", translate("Large"))
    rsc.rmempty = false

    rsn = s1:taboption("resource", ListValue, "recursion",
        translate("Recursion Strength"),
        translate("Recursion activity affects memory growth and CPU load"))
    rsn:value("default", translate("Default"))
    rsn:value("passive", translate("Passive"))
    rsn:value("aggressive", translate("Aggressive"))
    rsn.rmempty = false

    qry = s1:taboption("resource", Flag, "query_minimize",
        translate("Query Minimize"),
        translate("Break down query components for limited added privacy"))
    qry.optional = true
    qry:depends("recursion", "passive")
    qry:depends("recursion", "aggressive")

    qrs = s1:taboption("resource", Flag, "query_min_strict",
        translate("Strict Minimize"),
        translate("Strict version of 'query minimize' but it can break DNS"))
    qrs.optional = true
    qrs:depends("query_minimize", true)

    eds = s1:taboption("resource", Value, "edns_size",
        translate("EDNS Size"),
        translate("Limit extended DNS packet size"))
    eds.datatype = "and(uinteger,min(512),max(4096))"
    eds.placeholder = "1280"

    tlm = s1:taboption("resource", Value, "ttl_min",
        translate("TTL Minimum"),
        translate("Prevent excessively short cache periods"))
    tlm.datatype = "and(uinteger,min(0),max(1200))"
    tlm.placeholder = "120"

    rtt = s1:taboption("resource", Value, "rate_limit",
        translate("Query Rate Limit"),
        translate("Prevent client query overload; zero is off"))
    rtt.datatype = "and(uinteger,min(0),max(5000))"
    rtt.placeholder = "0"

    stt = s1:taboption("resource", Flag, "extended_stats",
        translate("Extended Statistics"),
        translate("Extended statistics are printed from unbound-control"))
    stt.rmempty = false

else
    ag2 = s1:taboption("basic", Value, "root_age",
        translate("Root DSKEY Age"),
        translate("Limit days between RFC5011 copies to reduce flash writes"))
    ag2.datatype = "and(uinteger,min(1),max(99))"
    ag2:value("3", "3")
    ag2:value("9", "9 ("..translate("default")..")")
    ag2:value("12", "12")
    ag2:value("24", "24")
    ag2:value("99", "99 ("..translate("never")..")")

    tgr = s1:taboption("basic", Value, "trigger_interface",
        translate("Trigger Networks"),
        translate("Networks that may trigger Unbound to reload (avoid wan6)"))
    tgr.template = "cbi/network_netlist"
    tgr.widget = "checkbox"
    tgr.rmempty = true
    tgr.cast = "string"
    tgr.nocreate = true
end


function ena.cfgvalue(self, section)
    return sy.init.enabled("unbound") and self.enabled or self.disabled
end


function ena.write(self, section, value)
    if (value == "1") then
        sy.init.enable("unbound")
        sy.call("/etc/init.d/unbound start >/dev/null 2>&1")

    else
        sy.call("/etc/init.d/unbound stop >/dev/null 2>&1")
        sy.init.disable("unbound")
    end


    return Flag.write(self, section, value)
end


function m1.on_commit(self)
    if sy.init.enabled("unbound") then
        -- Restart Unbound with configuration
        sy.call("/etc/init.d/unbound restart >/dev/null 2>&1")

    else
        sy.call("/etc/init.d/unbound stop >/dev/null 2>&1")
    end
end


function m1.on_apply(self)
    -- reload the page because some options hide
    ht.redirect(ds.build_url("admin", "services", "unbound", "configure"))
end


return m1

