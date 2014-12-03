--[[
smap_devinfo - SIP Device Information

(c) 2009 Daniel Dickinson

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--

require("luci.i18n")
require("luci.util")
require("luci.sys")
require("luci.model.uci")
require("luci.controller.luci_diag.smap_common")
require("luci.controller.luci_diag.devinfo_common")

local debug = false

m = SimpleForm("luci-smap-to-devinfo", translate("SIP Device Information"), translate("Scan for supported SIP devices on specified networks."))
m.reset = false
m.submit = false

local outnets = luci.controller.luci_diag.smap_common.get_params()
luci.controller.luci_diag.devinfo_common.run_processes(outnets, luci.controller.luci_diag.smap_common.command_function)
luci.controller.luci_diag.devinfo_common.parse_output(m, outnets, true, "smap", false, debug)
luci.controller.luci_diag.smap_common.action_links(m, false)

return m
