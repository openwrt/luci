--[[
LuCI - Lua Configuration Interface

(c) 2009 Daniel Dickinson

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--

require("luci.controller.luci_diag.devinfo_common")

m = Map("luci_devinfo", translate("Network Device Scanning Configuration"), translate("Configure scanning for devices on specified networks. Decreasing \'Timeout\', \'Repeat Count\', and/or \'Sleep Between Requests\' may speed up scans, but also may fail to find some devices."))

s = m:section(SimpleSection, "", translate("Use Configuration"))
b = s:option(DummyValue, "_scans", translate("Perform Scans (this can take a few minutes)"))
b.value = ""
b.titleref = luci.dispatcher.build_url("admin", "status", "netdiscover_devinfo")

scannet = m:section(TypedSection, "netdiscover_scannet", translate("Scanning Configuration"), translate("Networks to scan for devices"))
scannet.addremove = true
scannet.anonymous = false

luci.controller.luci_diag.devinfo_common.config_devinfo_scan(m, scannet)

return m
