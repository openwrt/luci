--[[

Luci configuration model for statistics - collectd load plugin configuration
(c) 2008 Freifunk Leipzig / Jo-Philipp Wich <xm@leipzig.freifunk.net>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

$Id$

]]--

m = Map("luci_statistics",
	translate("Load Plugin Configuration"),
	translate(
		"The load plugin collects statistics about the general system load."
	))

-- collectd_wireless config section
s = m:section( NamedSection, "collectd_load", "luci_statistics" )

-- collectd_wireless.enable
enable = s:option( Flag, "enable", translate("Enable this plugin") )
enable.default = 0

return m
