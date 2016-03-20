--[[

]]--

local wa = require "luci.tools.webadmin"
local fs = require "nixio.fs"

m = Map("qos_guoguo", translate("Upload Settings"))

s = m:section(TypedSection, "upload_class", translate("Classification Rules"),
		translate("Each upload service class is specified by three parameters: percent bandwidth at capacity, minimum bandwidth and maximum bandwidth.") .. "<br />" ..
		translate("<em>Percent bandwidth</em> is the percentage of the total available bandwidth that should be allocated to this class when all available bandwidth is being used. If unused bandwidth is available, more can (and will) be allocated. The percentages can be configured to equal more (or less) than 100, but when the settings are applied the percentages will be adjusted proportionally so that they add to 100.").. "<br />" ..
		translate("<em>Minimum bandwidth</em> specifies the minimum service this class will be allocated when the link is at capacity. For certain applications like VoIP or online gaming it is better to specify a minimum service in bps rather than a percentage. QoS will satisfiy the minimum service of all classes first before allocating the remaining service to other waiting classes.") .. "<br />" ..
		translate("<em>Maximum bandwidth</em> specifies an absolute maximum amount of bandwidth this class will be allocated in kbit/s. Even if unused bandwidth is available, this service class will never be permitted to use more than this amount of bandwidth.")
	)
s.addremove = true
s.template = "cbi/tblsection"


name = s:option(Value, "name", translate("Class Name"))

pb = s:option(Value, "percent_bandwidth", translate("Percent bandwidth at capacity"))

minb = s:option(Value, "min_bandwidth", translate("Minimum bandwidth"))
minb.datatype = "and(uinteger,min(0))"

maxb = s:option(Value, "max_bandwidth", translate("Maximum bandwidth"))
maxb.datatype = "and(uinteger,min(0))"

s = m:section(TypedSection, "upload_rule",translate("Classification Rules"),
	translate("Packets are tested against the rules in the order specified -- rules toward the top have priority. As soon as a packet matches a rule it is classified, and the rest of the rules are ignored. The order of the rules can be altered using the arrow controls.")
)

s.addremove = true
s.sortable = true
s.anonymous = true
s.template = "cbi/tblsection"

class = s:option(Value, "class", translate("Service Class"))
for line in io.lines("/etc/config/qos_guoguo") do
	local str = line
	line = string.gsub(line, "config ['\"]*upload_class['\"]* ", "")
	if str ~= line then
		line = string.gsub(line, "^'", "")
		line = string.gsub(line, "^\"", "")
		line = string.gsub(line, "'$", "")
		line = string.gsub(line, "\"$", "")
		class:value(line, m.uci:get("qos_guoguo", line, "name"))
	end
end
pr = s:option(Value, "proto", translate("Application Protocol"))
pr:value("tcp")
pr:value("udp")
pr:value("icmp")
pr:value("gre")
pr.rmempty = "true"

sip = s:option(Value, "source", translate("Source IP"))
wa.cbi_add_knownips(sip)
sip.datatype = "and(ipaddr)"

dip = s:option(Value, "destination", translate("Destination IP"))
wa.cbi_add_knownips(dip)
dip.datatype = "and(ipaddr)"

s:option(Value, "dstport", translate("Destination Port")).datatype = "and(uinteger,max(65536),min(1))"

s:option(Value, "srcport", translate("Source Port")).datatype = "and(uinteger,max(65536),min(1))"

min_pkt_size = s:option(Value, "min_pkt_size", translate("Minimum Packet Length"))
min_pkt_size.datatype = "and(uinteger,min(1))"

max_pkt_size = s:option(Value, "max_pkt_size", translate("Maximum Packet Length"))
max_pkt_size.datatype = "and(uinteger,min(1))"

connbytes_kb = s:option(Value, "connbytes_kb", translate("Connection bytes reach"))
connbytes_kb.datatype = "and(uinteger,min(0))"

return m
