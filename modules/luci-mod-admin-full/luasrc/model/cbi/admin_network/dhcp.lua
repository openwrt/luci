-- Copyright 2008 Steven Barth <steven@midlink.org>
-- Licensed to the public under the Apache License 2.0.

local ipc = require "luci.ip"
local o
require "luci.util"

m = Map("dhcp", translate("DHCP"),
	translate("The <abbr title=\"Dynamic Host Configuration Protocol" ..
		"\">DHCP</abbr> protocol allows stateful configuraion of hosts on a network."))

s = m:section(NamedSection, "odhcpd", "odhcpd", translate("Server Settings"))
s.anonymous = true
s.addremove = false

o = s:option(Value, "leasefile", translate("Leasefile"),
	translate("File to store assigned and static leases, and for use as a /etc/hosts format file for DNS. NB."))
o.default = "/var/hosts/odhcpd"

o = s:option(Value, "leasetrigger", translate("Lease trigger"),
	translate("Script to run on lease activity."))
o.default = "/usr/sbin/odhcpd-update"

s = m:section(NamedSection, "odhcpd", "odhcpd", translate("odhcpd Server Settings"))
s.anonymous = true
s.addremove = false

o = s:option(Flag, "maindhcp", translate("odhcpd as DHCPv4+DHCPv6 Server"),
	translate("Use odhcpd as DHCPv4 and DHCPv6 server instead of only for DHCPv6; DNSMasq DHCP will be disabled for the interfaces on which odhcp listens."))
o.default = false

o = s:option(Value, "leasefile", translate("Leasefile"),
	translate("File to store assigned and static leases, and for use as a /etc/hosts format file for DNS. NB."))
o.default = "/var/hosts/odhcpd"

o = s:option(Value, "leasetrigger", translate("Lease trigger"),
	translate("Script to run on lease activity."))
o.default = "/usr/sbin/odhcpd-update"

m:section(SimpleSection).template = "admin_network/lease_status"

s = m:section(TypedSection, "host", translate("Static Leases"),
	translate("Static leases are used to assign fixed IP addresses and symbolic hostnames to " ..
		"DHCP clients. They are also required for non-dynamic interface configurations where " ..
		"only hosts with a corresponding lease are served.") .. "<br />" ..
	translate("Use the <em>Add</em> Button to add a new lease entry. The host is identified " ..
		"by a <em>MAC Address</em> or a <em>DUID</em>. The <em>IPv4 Address</em> specifies the " ..
		"fixed address to use and the <em>Host ID</em> is the fixed IPv6 suffix to assign." ..
		"The optional <em>Lease time</em> can be used to set non-standard host-specific lease " ..
		"time, e.g. 12h, 3d or infinite."))

s.addremove = true
s.anonymous = true
s.template = "cbi/tblsection"

name = s:option(Value, "name", translate("Hostname"))
name.datatype = "hostname"
name.rmempty  = true

mac = s:option(Value, "mac", translate("<abbr title=\"Media Access Control\">MAC</abbr> Address"))
mac.datatype = "list(macaddr)"
mac.rmempty  = true

ip = s:option(Value, "ip", translate("<abbr title=\"Internet Protocol Version 4\">IPv4</abbr>-Address"))
ip.datatype = "or(ip4addr,'ignore')"

duid = s:option(Value, "duid", translate("<abbr title=\"DHCP Unique Identifier\">DUID</abbr>"))
duid.datatype = "and(rangelength(28,36),hexstring)"
duid.rmempty  = true

hostid = s:option(Value, "hostid", translate("<abbr title=\"Internet Protocol Version 6\">IPv6</abbr>-Suffix (hex)"))
hostid.datatype = "ip6hostid"
hostid.rmempty  = true

time = s:option(Value, "leasetime", translate("Lease time"))
time.rmempty  = true

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
		return nil, translate("One of hostname or MAC address must be specified!")
	end
	return Value.validate(self, value, section)
end

function hostid.validate(self, value, section)
	local m = duid:formvalue(section) or ""
	local n = name:formvalue(section) or ""
	if value and #n == 0 and #m == 0 then
		return nil, translate("One of hostname or DUID address must be specified!")
	end
	return Value.validate(self, value, section)
end


return m
