-- Copyright 2008 Steven Barth <steven@midlink.org>
-- Copyright 2010-2015 Jo-Philipp Wich <jow@openwrt.org>
-- Licensed to the public under the Apache License 2.0.

local ipc = require "luci.ip"
local sys = require "luci.sys"

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

sys.net.host_hints(function(mac, v4, v6, name)
	v6 = v6 and ipc.IPv6(v6)

	if v4 or (v6 and not v6:is6linklocal()) then
		ip:value(tostring(v4 or v6), "%s (%s)" %{ tostring(v4 or v6), name or mac })
	end
end)

return m
