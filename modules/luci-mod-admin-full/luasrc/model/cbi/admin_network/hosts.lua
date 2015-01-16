-- Copyright 2008 Steven Barth <steven@midlink.org>
-- Copyright 2010 Jo-Philipp Wich <jow@openwrt.org>
-- Licensed to the public under the Apache License 2.0.

require("luci.sys")
require("luci.util")
m = Map("dhcp", translate("Hostnames"))

s = m:section(TypedSection, "domain", translate("Host entries"))
s.addremove = true
s.anonymous = true
s.template = "cbi/tblsection"

hn = s:option(Value, "name", translate("Hostname"))
hn.datatype = "hostname"
hn.rmempty  = true

ip = s:option(Value, "ip", translate("IP address"))
ip.datatype = "ipaddr"
ip.rmempty  = true

local arptable = luci.sys.net.arptable() or {}
for i, dataset in ipairs(arptable) do
	ip:value(
		dataset["IP address"],
		"%s (%s)" %{ dataset["IP address"], dataset["HW address"] }
	)
end

return m
