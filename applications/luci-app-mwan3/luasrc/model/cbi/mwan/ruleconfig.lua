-- ------ extra functions ------ --

function ruleCheck() -- determine if rule needs a protocol specified
	local sourcePort = ut.trim(sys.exec("uci -p /var/state get mwan3." .. arg[1] .. ".src_port"))
	local destPort = ut.trim(sys.exec("uci -p /var/state get mwan3." .. arg[1] .. ".dest_port"))
	if sourcePort ~= "" or destPort ~= "" then -- ports configured
		local protocol = ut.trim(sys.exec("uci -p /var/state get mwan3." .. arg[1] .. ".proto"))
		if protocol == "" or protocol == "all" then -- no or improper protocol
			error_protocol = 1
		end
	end
end

function ruleWarn() -- display warning message at the top of the page
	if error_protocol == 1 then
		return "<font color=\"ff0000\"><strong>WARNING: this rule is incorrectly configured with no or improper protocol specified! Please configure a specific protocol!</strong></font>"
	else
		return ""
	end
end

function cbiAddPolicy(field)
	uci.cursor():foreach("mwan3", "policy",
		function (section)
			field:value(section[".name"])
		end
	)
end

function cbiAddProtocol(field)
	local protocols = ut.trim(sys.exec("cat /etc/protocols | grep '	# ' | awk '{print $1}' | grep -vw -e 'ip' -e 'tcp' -e 'udp' -e 'icmp' -e 'esp' | grep -v 'ipv6' | sort | tr '\n' ' '"))
	for p in string.gmatch(protocols, "%S+") do
		field:value(p)
	end
end

-- ------ rule configuration ------ --

dsp = require "luci.dispatcher"
sys = require "luci.sys"
ut = require "luci.util"
arg[1] = arg[1] or ""

error_protocol = 0
ruleCheck()


m5 = Map("mwan3", translate("MWAN Rule Configuration - ") .. arg[1],
	translate(ruleWarn()))
	m5.redirect = dsp.build_url("admin", "network", "mwan", "configuration", "rule")


mwan_rule = m5:section(NamedSection, arg[1], "rule", "")
	mwan_rule.addremove = false
	mwan_rule.dynamic = false


src_ip = mwan_rule:option(Value, "src_ip", translate("Source address"),
	translate("Supports CIDR notation (eg \"192.168.100.0/24\") without quotes"))
	src_ip.datatype = ipaddr

src_port = mwan_rule:option(Value, "src_port", translate("Source port"),
	translate("May be entered as a single or multiple port(s) (eg \"22\" or \"80,443\") or as a portrange (eg \"1024:2048\") without quotes"))

dest_ip = mwan_rule:option(Value, "dest_ip", translate("Destination address"),
	translate("Supports CIDR notation (eg \"192.168.100.0/24\") without quotes"))
	dest_ip.datatype = ipaddr

dest_port = mwan_rule:option(Value, "dest_port", translate("Destination port"),
	translate("May be entered as a single or multiple port(s) (eg \"22\" or \"80,443\") or as a portrange (eg \"1024:2048\") without quotes"))

proto = mwan_rule:option(Value, "proto", translate("Protocol"),
	translate("View the contents of /etc/protocols for protocol descriptions"))
	proto.default = "all"
	proto.rmempty = false
	proto:value("all")
	proto:value("ip")
	proto:value("tcp")
	proto:value("udp")
	proto:value("icmp")
	proto:value("esp")
	cbiAddProtocol(proto)

sticky = mwan_rule:option(ListValue, "sticky", translate("Sticky"),
	translate("Traffic from the same source IP address that previously matched this rule within the sticky timeout period will use the same WAN interface"))
	sticky.default = "0"
	sticky:value("1", translate("Yes"))
	sticky:value("0", translate("No"))

timeout = mwan_rule:option(Value, "timeout", translate("Sticky timeout"),
	translate("Seconds. Acceptable values: 1-1000000. Defaults to 600 if not set"))
	timeout.datatype = "range(1, 1000000)"

ipset = mwan_rule:option(Value, "ipset", translate("IPset"),
	translate("Name of IPset rule. Requires IPset rule in /etc/dnsmasq.conf (eg \"ipset=/youtube.com/youtube\")"))

use_policy = mwan_rule:option(Value, "use_policy", translate("Policy assigned"))
	cbiAddPolicy(use_policy)
	use_policy:value("unreachable", translate("unreachable (reject)"))
	use_policy:value("blackhole", translate("blackhole (drop)"))
	use_policy:value("default", translate("default (use main routing table)"))


-- ------ currently configured policies ------ --

mwan_policy = m5:section(TypedSection, "policy", translate("Currently Configured Policies"))
	mwan_policy.addremove = false
	mwan_policy.dynamic = false
	mwan_policy.sortable = false
	mwan_policy.template = "cbi/tblsection"


return m5
