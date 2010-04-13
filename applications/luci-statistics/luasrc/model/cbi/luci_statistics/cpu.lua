--[[

Luci configuration model for statistics - collectd cpu plugin configuration
(c) 2008 Freifunk Leipzig / Jo-Philipp Wich <xm@leipzig.freifunk.net>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

$Id$

]]--

m = Map("luci_statistics",
	translate("CPU Plugin Configuration"),
	translate("The cpu plugin collects basic statistics about the processor usage."))

-- collectd_cpu config section
s = m:section( NamedSection, "collectd_cpu", "luci_statistics" )

-- collectd_cpu.enable
enable = s:option( Flag, "enable", translate("Enable this plugin") )
enable.default = 0

return m
