--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>
Copyright 2008-2010 Jo-Philipp Wich <xm@subsignal.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--

m = Map("upnpd", translate("Universal Plug & Play"),
	translate("UPnP allows clients in the local network to automatically configure the router."))

m:section(SimpleSection).template  = "upnp_status"

s = m:section(NamedSection, "config", "upnpd", "")
s.addremove = false

e = s:option(Flag, "enabled", translate("Enable UPnP Service"))
e.rmempty  = false
e.enabled  = "1"
e.disabled = "0"

function e.write(self, section, value)
	if value == "1" then
		luci.sys.call("/etc/init.d/miniupnpd enable")
		luci.sys.call("/etc/init.d/miniupnpd start")
	else
		luci.sys.call("/etc/init.d/miniupnpd stop")
		luci.sys.call("/etc/init.d/miniupnpd disable")
	end

	Value.write(self, section, value)
end

s:option(Flag, "enable_natpmp", translate("Enable NAT-PMP")).rmempty = true
s:option(Flag, "secure_mode", translate("Enable secure mode")).rmempty = true
s:option(Flag, "log_output", translate("Log output")).rmempty = true
s:option(Value, "download", translate("Downlink"), "kByte/s").rmempty = true
s:option(Value, "upload", translate("Uplink"), "kByte/s").rmempty = true

return m
