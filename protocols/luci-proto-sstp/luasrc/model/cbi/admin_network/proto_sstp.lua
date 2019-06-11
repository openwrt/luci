--[[
LuCI - Lua Configuration Interface

Copyright 2011-2012 Jo-Philipp Wich <xm@subsignal.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0
]]--

local map, section, net = ...

local server, username, password
local defaultroute, metric, peerdns, dns, mtu , ipv6 , pppd_options , sstp_options , log_level

server = section:taboption("general", Value, "server", translate("SSTP Server"))
server.datatype = "host"


username = section:taboption("general", Value, "username", translate("PAP/CHAP username"))


password = section:taboption("general", Value, "password", translate("PAP/CHAP password"))
password.password = true

ipv6 = section:taboption("advanced", Flag, "ipv6",
	translate("IPv6 support"),
	translate("If checked, add '+ipv6' to pppd options"))

log_level = section:taboption("advanced", Value, "log_level",
	translate("sstpc log-level"))

log_level.placeholder = "0"
log_level.datatype    = "uinteger"

defaultroute = section:taboption("advanced", Flag, "defaultroute",
	translate("Use default gateway"),
	translate("If unchecked, no default route is configured"))

defaultroute.default = defaultroute.enabled

metric = section:taboption("advanced", Value, "metric",
	translate("Use gateway metric"))

metric.placeholder = "0"
metric.datatype    = "uinteger"
metric:depends("defaultroute", defaultroute.enabled)


peerdns = section:taboption("advanced", Flag, "peerdns",
	translate("Use DNS servers advertised by peer"),
	translate("If unchecked, the advertised DNS server addresses are ignored"))

peerdns.default = peerdns.enabled


dns = section:taboption("advanced", DynamicList, "dns",
	translate("Use custom DNS servers"))

dns:depends("peerdns", "")
dns.datatype = "ipaddr"
dns.cast     = "string"

mtu = section:taboption("advanced", Value, "mtu", translate("Override MTU"))
mtu.placeholder = "1500"
mtu.datatype    = "max(9200)"

sstp_options = section:taboption("advanced", Value, "sstp_options", 
	translate("Extra sstpc options"),
	translate("e.g: --proxy 10.10.10.10 "))

pppd_options = section:taboption("advanced", Value, "pppd_options", 
	translate("Extra pppd options"),
	translate("e.g: dump "))

