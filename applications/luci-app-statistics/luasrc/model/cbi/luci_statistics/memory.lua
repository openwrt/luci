-- Copyright 2011 Manuel Munz <freifunk at somakoma dot de>
-- Licensed to the public under the Apache License 2.0.

m = Map("luci_statistics",
	translate("Memory Plugin Configuration"),
	translate("The memory plugin collects statistics about the memory usage."))

s = m:section( NamedSection, "collectd_memory", "luci_statistics" )

enable = s:option( Flag, "enable", translate("Enable this plugin") )
enable.default = 0

return m
