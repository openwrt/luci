-- Copyright 2008 Freifunk Leipzig / Jo-Philipp Wich <jow@openwrt.org>
-- Licensed to the public under the Apache License 2.0.

m = Map("collectd",
	translate("Load Plugin Configuration"),
	translate(
		"The load plugin collects statistics about the general system load."
	))

-- collectd_wireless config section
s = m:section( NamedSection, "load", "plugin" )

-- collectd_wireless.enable
enable = s:option( Flag, "enable", translate("Enable this plugin") )
enable.default = 0

return m
