-- Copyright 2008 Steven Barth <steven@midlink.org>
-- Licensed to the public under the Apache License 2.0.

local ipc = require "luci.ip"

m = Map("dhcp", translate("DHCP and DNS"),
	translate("Dnsmasq is a combined <abbr title=\"Dynamic Host Configuration Protocol" ..
		"\">DHCP</abbr>-Server and <abbr title=\"Domain Name System\">DNS</abbr>-" ..
		"Forwarder for <abbr title=\"Network Address Translation\">NAT</abbr> " ..
		"firewalls"))

s = m:section(TypedSection, "dnsmasq", translate("Server Settings"))
s.anonymous = true
s.addremove = false

s:tab("general", translate("General Settings"))
s:tab("files", translate("Resolv and Hosts Files"))
s:tab("tftp", translate("TFTP Settings"))
s:tab("advanced", translate("Advanced Settings"))

s:taboption("general", Flag, "domainneeded",
	translate("Domain required"),
	translate("Don't forward <abbr title=\"Domain Name System\">DNS</abbr>-Requests without " ..
		"<abbr title=\"Domain Name System\">DNS</abbr>-Name"))

s:taboption("general", Flag, "authoritative",
	translate("Authoritative"),
	translate("This is the only <abbr title=\"Dynamic Host Configuration Protocol\">DHCP</" ..
		"abbr> in the local network"))


s:taboption("files", Flag, "readethers",
	translate("Use <code>/etc/ethers</code>"),
	translate("Read <code>/etc/ethers</code> to configure the <abbr title=\"Dynamic Host " ..
		"Configuration Protocol\">DHCP</abbr>-Server"))

s:taboption("files", Value, "leasefile",
	translate("Leasefile"),
	translate("file where given <abbr title=\"Dynamic Host Configuration Protocol\">DHCP</" ..
		"abbr>-leases will be stored"))

s:taboption("files", Flag, "noresolv",
	translate("Ignore resolve file")).optional = true

rf = s:taboption("files", Value, "resolvfile",
	translate("Resolve file"),
	translate("local <abbr title=\"Domain Name System\">DNS</abbr> file"))

rf:depends("noresolv", "")
rf.optional = true


s:taboption("files", Flag, "nohosts",
	translate("Ignore <code>/etc/hosts</code>")).optional = true

s:taboption("files", DynamicList, "addnhosts",
	translate("Additional Hosts files")).optional = true

qu = s:taboption("advanced", Flag, "quietdhcp",
	translate("Suppress logging"),
	translate("Suppress logging of the routine operation of these protocols"))
qu.optional = true

se = s:taboption("advanced", Flag, "sequential_ip",
	translate("Allocate IP sequentially"),
	translate("Allocate IP addresses sequentially, starting from the lowest available address"))
se.optional = true

s:taboption("advanced", Flag, "boguspriv",
	translate("Filter private"),
	translate("Do not forward reverse lookups for local networks"))

s:taboption("advanced", Flag, "filterwin2k",
	translate("Filter useless"),
	translate("Do not forward requests that cannot be answered by public name servers"))


s:taboption("advanced", Flag, "localise_queries",
	translate("Localise queries"),
	translate("Localise hostname depending on the requesting subnet if multiple IPs are available"))

s:taboption("general", Value, "local",
	translate("Local server"),
	translate("Local domain specification. Names matching this domain are never forwarded and are resolved from DHCP or hosts files only"))

s:taboption("general", Value, "domain",
	translate("Local domain"),
	translate("Local domain suffix appended to DHCP names and hosts file entries"))

s:taboption("advanced", Flag, "expandhosts",
	translate("Expand hosts"),
	translate("Add local domain suffix to names served from hosts files"))

s:taboption("advanced", Flag, "nonegcache",
	translate("No negative cache"),
	translate("Do not cache negative replies, e.g. for not existing domains"))

s:taboption("advanced", Flag, "strictorder",
	translate("Strict order"),
	translate("<abbr title=\"Domain Name System\">DNS</abbr> servers will be queried in the " ..
		"order of the resolvfile")).optional = true


bn = s:taboption("advanced", DynamicList, "bogusnxdomain", translate("Bogus NX Domain Override"),
	translate("List of hosts that supply bogus NX domain results"))

bn.optional = true
bn.placeholder = "67.215.65.132"


s:taboption("general", Flag, "logqueries",
	translate("Log queries"),
	translate("Write received DNS requests to syslog")).optional = true

df = s:taboption("general", DynamicList, "server", translate("DNS forwardings"),
	translate("List of <abbr title=\"Domain Name System\">DNS</abbr> " ..
			"servers to forward requests to"))

df.optional = true
df.placeholder = "/example.org/10.1.2.3"


rp = s:taboption("general", Flag, "rebind_protection",
	translate("Rebind protection"),
	translate("Discard upstream RFC1918 responses"))

rp.rmempty = false


rl = s:taboption("general", Flag, "rebind_localhost",
	translate("Allow localhost"),
	translate("Allow upstream responses in the 127.0.0.0/8 range, e.g. for RBL services"))

rl:depends("rebind_protection", "1")


rd = s:taboption("general", DynamicList, "rebind_domain",
	translate("Domain whitelist"),
	translate("List of domains to allow RFC1918 responses for"))

rd:depends("rebind_protection", "1")
rd.datatype = "host"
rd.placeholder = "ihost.netflix.com"


pt = s:taboption("advanced", Value, "port",
	translate("<abbr title=\"Domain Name System\">DNS</abbr> server port"),
	translate("Listening port for inbound DNS queries"))

pt.optional = true
pt.datatype = "port"
pt.placeholder = 53


qp = s:taboption("advanced", Value, "queryport",
	translate("<abbr title=\"Domain Name System\">DNS</abbr> query port"),
	translate("Fixed source port for outbound DNS queries"))

qp.optional = true
qp.datatype = "port"
qp.placeholder = translate("any")


lm = s:taboption("advanced", Value, "dhcpleasemax",
	translate("<abbr title=\"maximal\">Max.</abbr> <abbr title=\"Dynamic Host Configuration " ..
		"Protocol\">DHCP</abbr> leases"),
	translate("Maximum allowed number of active DHCP leases"))

lm.optional = true
lm.datatype = "uinteger"
lm.placeholder = translate("unlimited")


em = s:taboption("advanced", Value, "ednspacket_max",
	translate("<abbr title=\"maximal\">Max.</abbr> <abbr title=\"Extension Mechanisms for " ..
		"Domain Name System\">EDNS0</abbr> packet size"),
	translate("Maximum allowed size of EDNS.0 UDP packets"))

em.optional = true
em.datatype = "uinteger"
em.placeholder = 1280


cq = s:taboption("advanced", Value, "dnsforwardmax",
	translate("<abbr title=\"maximal\">Max.</abbr> concurrent queries"),
	translate("Maximum allowed number of concurrent DNS queries"))

cq.optional = true
cq.datatype = "uinteger"
cq.placeholder = 150


s:taboption("tftp", Flag, "enable_tftp",
	translate("Enable TFTP server")).optional = true

tr = s:taboption("tftp", Value, "tftp_root",
	translate("TFTP server root"),
	translate("Root directory for files served via TFTP"))

tr.optional = true
tr:depends("enable_tftp", "1")
tr.placeholder = "/"


db = s:taboption("tftp", Value, "dhcp_boot",
	translate("Network boot image"),
	translate("Filename of the boot image advertised to clients"))

db.optional = true
db:depends("enable_tftp", "1")
db.placeholder = "pxelinux.0"


m:section(SimpleSection).template = "admin_network/lease_status"

s = m:section(TypedSection, "host", translate("Static Leases"),
	translate("Static leases are used to assign fixed IP addresses and symbolic hostnames to " ..
		"DHCP clients. They are also required for non-dynamic interface configurations where " ..
		"only hosts with a corresponding lease are served.") .. "<br />" ..
	translate("Use the <em>Add</em> Button to add a new lease entry. The <em>MAC-Address</em> " ..
		"indentifies the host, the <em>IPv4-Address</em> specifies to the fixed address to " ..
		"use and the <em>Hostname</em> is assigned as symbolic name to the requesting host."))

s.addremove = true
s.anonymous = true
s.template = "cbi/tblsection"

name = s:option(Value, "name", translate("Hostname"))
name.datatype = "hostname"
name.rmempty  = true

mac = s:option(Value, "mac", translate("<abbr title=\"Media Access Control\">MAC</abbr>-Address"))
mac.datatype = "list(macaddr)"
mac.rmempty  = true

ip = s:option(Value, "ip", translate("<abbr title=\"Internet Protocol Version 4\">IPv4</abbr>-Address"))
ip.datatype = "or(ip4addr,'ignore')"

hostid = s:option(Value, "hostid", translate("<abbr title=\"Internet Protocol Version 6\">IPv6</abbr>-Suffix (hex)"))

ipc.neighbors({ family = 4 }, function(n)
	if n.mac and n.dest then
		ip:value(n.dest:string())
		mac:value(n.mac, "%s (%s)" %{ n.mac, n.dest:string() })
	end
end)

function ip.validate(self, value, section)
	local m = mac:formvalue(section) or ""
	local n = name:formvalue(section) or ""
	if value and #n == 0 and #m == 0 then
		return nil, translate("One of hostname or mac address must be specified!")
	end
	return Value.validate(self, value, section)
end


return m
