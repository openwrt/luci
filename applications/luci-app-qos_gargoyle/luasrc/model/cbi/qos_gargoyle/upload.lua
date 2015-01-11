--[[

]]--

local wa = require "luci.tools.webadmin"
local fs = require "nixio.fs"

m = Map("qos_gargoyle", translate("upload"),translate("UpLoad set"))

s = m:section(TypedSection, "upload_class", translate("upload_class"))
s.addremove = true
s.template = "cbi/tblsection"

name = s:option(Value, "name", translate("name"))

pb = s:option(Value, "percent_bandwidth", translate("percent_bandwidth"), translate("percent of total bandwidth to use"))

minb = s:option(Value, "min_bandwidth", translate("min_bandwidth"), translate("min bandwidth useage in absolute speed (kbit/s)"))
minb.datatype = "and(uinteger,min(0))"

maxb = s:option(Value, "max_bandwidth", translate("max_bandwidth"), translate("max bandwidth useage in absolute speed (kbit/s)"))
maxb.datatype = "and(uinteger,min(0))"

minRTT = s:option(ListValue, "minRTT", translate("minRTT"))
minRTT:value("Yes")
minRTT:value("No")
minRTT.default = "No"


local tmp = "upload_rule"
s = m:section(TypedSection, "upload_rule", translate(tmp))
s.addremove = true
--s.sortable = true
s.template = "cbi/tblsection"

class = s:option(Value, "class", translate("class"), translate("<abbr title=\"name of bandwidth class to use if rule matches, this is required in each rule section\">Help</abbr>"))
for line in io.lines("/etc/config/qos_gargoyle") do
	local str = line
	line = string.gsub(line, "config ['\"]*upload_class['\"]* ", "")
	if str ~= line then
		line = string.gsub(line, "^'", "")
		line = string.gsub(line, "^\"", "")
		line = string.gsub(line, "'$", "")
		line = string.gsub(line, "\"$", "")
		class:value(line, translate(m.uci:get("qos_gargoyle", line, "name")))
	end
end
class.default = "uclass_2"

to = s:option(Value, "test_order", translate("test_order"), translate("<abbr title=\"an integer that specifies the order in which the rule should be checked for a match (lower numbers are checked first)\">Help</abbr>"))
to.rmempty = "true"
minb.datatype = "and(uinteger,min(0))"
to:value(100)
to:value(200)
to:value(300)
to:value(400)
to:value(500)
to:value(600)
to:value(700)
to:value(800)
to:value(900)

pr = s:option(Value, "proto", translate("proto"), translate("<abbr title=\"check that packet has this protocol (tcp, udp, both)\">Help</abbr>"))
pr:value("tcp")
pr:value("udp")
pr:value("icmp")
pr:value("gre")
pr.rmempty = "true"

sip = s:option(Value, "source", translate("source ip"), translate("<abbr title=\"check that packet has this source ip, can optionally have /[mask] after it (see -s option in iptables man page)\">Help</abbr>"))
wa.cbi_add_knownips(sip)
sip.datatype = "and(ipaddr)"

dip = s:option(Value, "destination", translate("destination ip"), translate("<abbr title=\"check that packet has this destination ip, can optionally have /[mask] after it (see -d option in iptables man page)\">Help</abbr>"))
wa.cbi_add_knownips(dip)
dip.datatype = "and(ipaddr)"

dport = s:option(Value, "dstport", translate("destination port"), translate("<abbr title=\"check that packet has this destination port\">Help</abbr>"))
dport.datatype = "and(uinteger,max(65536),min(1))"

sport = s:option(Value, "srcport", translate("source port"), translate("<abbr title=\"check that packet has this source port\">Help</abbr>"))
sport.datatype = "and(uinteger,max(65536),min(1))"

min_pkt_size = s:option(Value, "min_pkt_size", translate("min_pkt_size"), translate("<abbr title=\"check that packet is at least this size (in bytes)\">Help</abbr>"))
min_pkt_size.datatype = "and(uinteger,min(1))"

max_pkt_size = s:option(Value, "max_pkt_size", translate("max_pkt_size"), translate("<abbr title=\"check that packet is no larger than this size (in bytes)\">Help</abbr>"))
max_pkt_size.datatype = "and(uinteger,min(1))"

connbytes_kb = s:option(Value, "connbytes_kb", translate("connbytes_kbyte"), translate("<abbr title=\"kbyte\">Help</abbr>"))
connbytes_kb.datatype = "and(uinteger,min(0))"

layer7 = s:option(Value, "layer7", translate("layer7"), translate("<abbr title=\"check whether packet matches layer7 specification\">Help</abbr>"))
local pats = io.popen("find /etc/l7-protocols/ -type f -name '*.pat'")
if pats then
	local l
	while true do
		l = pats:read("*l")
		if not l then break end

		l = l:match("([^/]+)%.pat$")
		if l then
			layer7:value(l)
		end
	end
	pats:close()
end

ipp2p = s:option(Value, "ipp2p", translate("ipp2p"), translate("<abbr title=\"check wither packet matches ipp2p specification (used to recognize p2p protocols),ipp2p or all will match any of the specified p2p protocols, you can also specifically match any protocol listed in the documentation here: http://ipp2p.org/docu_en.html\">Help</abbr>"))
ipp2p:value("ipp2p")
ipp2p:value("all")

return m
