-- Copyright 2014 Aedan Renner <chipdankly@gmail.com>
-- Copyright 2018 Florian Eckert <fe@dev.tdt.de>
-- Licensed to the public under the GNU General Public License v2.

local dsp = require "luci.dispatcher"
local util   = require("luci.util")

local m, s, o

arg[1] = arg[1] or ""

local ipsets = util.split(util.trim(util.exec("ipset -n -L 2>/dev/null | grep -v mwan3_ | sort")), "\n", nil, true) or {}

m = Map("mwan3", translatef("MWAN Rule Configuration - %s", arg[1]))
m.redirect = dsp.build_url("admin", "network", "mwan", "rule")

s = m:section(NamedSection, arg[1], "rule", "")
s.addremove = false
s.dynamic = false

o = s:option(ListValue, "family", translate("Internet Protocol"))
o.default = ""
o:value("", translate("IPv4 and IPv6"))
o:value("ipv4", translate("IPv4 only"))
o:value("ipv6", translate("IPv6 only"))

o = s:option(Value, "src_ip", translate("Source address"),
	translate("Supports CIDR notation (eg \"192.168.100.0/24\") without quotes"))
o.datatype = ipaddr

o = s:option(Value, "src_port", translate("Source port"),
	translate("May be entered as a single or multiple port(s) (eg \"22\" or \"80,443\") or as a portrange (eg \"1024:2048\") without quotes"))
o:depends("proto", "tcp")
o:depends("proto", "udp")

o = s:option(Value, "dest_ip", translate("Destination address"),
	translate("Supports CIDR notation (eg \"192.168.100.0/24\") without quotes"))
o.datatype = ipaddr

o = s:option(Value, "dest_port", translate("Destination port"),
	translate("May be entered as a single or multiple port(s) (eg \"22\" or \"80,443\") or as a portrange (eg \"1024:2048\") without quotes"))
o:depends("proto", "tcp")
o:depends("proto", "udp")

o = s:option(Value, "proto", translate("Protocol"),
	translate("View the content of /etc/protocols for protocol description"))
o.default = "all"
o.rmempty = false
o:value("all")
o:value("tcp")
o:value("udp")
o:value("icmp")
o:value("esp")

o = s:option(ListValue, "sticky", translate("Sticky"),
	translate("Traffic from the same source IP address that previously matched this rule within the sticky timeout period will use the same WAN interface"))
o.default = "0"
o:value("1", translate("Yes"))
o:value("0", translate("No"))

o = s:option(Value, "timeout", translate("Sticky timeout"),
	translate("Seconds. Acceptable values: 1-1000000. Defaults to 600 if not set"))
o.datatype = "range(1, 1000000)"

o = s:option(Value, "ipset", translate("IPset"),
	translate("Name of IPset rule. Requires IPset rule in /etc/dnsmasq.conf (eg \"ipset=/youtube.com/youtube\")"))
o:value("", translate("-- Please choose --"))
for _, z in ipairs(ipsets) do
	o:value(z)
end

o = s:option(Flag, "logging", translate("Logging"),
	translate("Enables firewall rule logging (global mwan3 logging must also be enabled)"))

o = s:option(Value, "use_policy", translate("Policy assigned"))
m.uci:foreach("mwan3", "policy",
	function(s)
		o:value(s['.name'], s['.name'])
	end
)
o:value("unreachable", translate("unreachable (reject)"))
o:value("blackhole", translate("blackhole (drop)"))
o:value("default", translate("default (use main routing table)"))

return m
