-- /usr/lib/lua/luci/model/cbi/luci_statistics/sqm.lua
-- Copyright 2011 Jo-Philipp Wich <jow@openwrt.org>
-- Copyright 2020 Joseph Nahmias <joe@nahmias.net>
-- based on /usr/lib/lua/luci/model/cbi/luci_statistics/iwinfo.lua
-- Licensed to the public under the Apache License 2.0.

local m, s, o

m = Map("luci_statistics",
	translate("SQM Plugin Configuration"),
	translate("The sqm plugin collects statistics about smart queue management QoS."))

s = m:section(NamedSection, "collectd_sqm", "luci_statistics")

o = s:option(Flag, "enable", translate("Enable this plugin"))
o.default = 0

o = s:option(DynamicList, "Interfaces", translate("Monitor interfaces"))
o.template = "cbi/network_ifacelist"
o.widget   = "checkbox"
o.nocreate = true
o:depends("enable", 1)

return m
