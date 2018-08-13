--[[
LuCI - Lua Configuration Interface

Copyright 2015 Cezary Jackiewicz <cezary.jackiewicz@gmail.com>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0
]]--

local map, section, net = ...

local device, apn, service, pincode, username, password
local ipv6, delay, defaultroute, metric, peerdns, dns


device = section:taboption("general", Value, "device", translate("Modem device"))
device.rmempty = false

local dev
for dev in nixio.fs.glob("/dev/ttyUSB*") do
    device:value(dev)
end
for dev in nixio.fs.glob("/dev/cdc-wdm*") do
    device:value(dev)
end

mode = section:taboption("general", Value, "mode", translate("Service Type"))
mode:value("", translate("Modem default"))
mode:value("preferlte", translate("Prefer LTE"))
mode:value("preferumts", translate("Prefer UMTS"))
mode:value("lte", "LTE")
mode:value("umts", "UMTS/GPRS")
mode:value("gsm", translate("GPRS only"))
mode:value("auto", translate("auto"))


mode = section:taboption("general", Value, "pdptype", translate("IP Protocol"))
mode.default = "IP"
mode:value("IP", translate("IPv4"))
mode:value("IPV4V6", translate("IPv4+IPv6"))
mode:value("IPV6", translate("IPv6"))


apn = section:taboption("general", Value, "apn", translate("APN"))


pincode = section:taboption("general", Value, "pincode", translate("PIN"))


username = section:taboption("general", Value, "username", translate("PAP/CHAP username"))


password = section:taboption("general", Value, "password", translate("PAP/CHAP password"))
password.password = true


if luci.model.network:has_ipv6() then

	ipv6 = section:taboption("advanced", ListValue, "ipv6")
	ipv6:value("auto", translate("Automatic"))
	ipv6:value("0", translate("Disabled"))
	ipv6:value("1", translate("Manual"))
	ipv6.default = "auto"

end


delay = section:taboption("advanced", Value, "delay",
	translate("Modem init timeout"),
	translate("Maximum amount of seconds to wait for the modem to become ready"))

delay.placeholder = "10"
delay.datatype    = "min(1)"


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

