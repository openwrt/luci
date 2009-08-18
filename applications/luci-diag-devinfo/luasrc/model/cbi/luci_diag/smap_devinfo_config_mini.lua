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

m = Map("luci_devinfo", translate("l_d_d_sdc_mini_smap_to_devinfo_config"), translate("l_d_d_sdc_mini_smap_to_devinfo_config_descr"))

s = m:section(SimpleSection, "", translate("l_d_d_sdc_mini_use_config"))
b = s:option(DummyValue, "_scans", translate("l_d_d_sdc_mini_do_scans"))
b.value = ""
b.titleref = luci.dispatcher.build_url("mini", "diag", "phone_scan")

scannet = m:section(TypedSection, "smap_scannet", translate("l_d_d_sdc_mini_smap_scannet"), translate("l_d_d_sdc_mini_smap_scannet_descr"))
scannet.addremove = true
scannet.anonymous = false

local ports
ports = scannet:option(Value, "ports", translate("l_d_d_sdc_mini_ports"))
ports.optional = true
ports.rmempty = true

luci.controller.luci_diag.devinfo_common.config_devinfo_scan(m, scannet)


return m
