--[[

Luci configuration model for statistics - collectd interface plugin configuration
(c) 2008 Freifunk Leipzig / Jo-Philipp Wich <xm@leipzig.freifunk.net>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

$Id$

]]--

require("luci.sys")


m = Map("luci_statistics",
	translate("Interface Plugin Configuration"),
	translate(
		"The interface plugin collects traffic statistics on " ..
		"selected interfaces."
	))

-- collectd_interface config section
s = m:section( NamedSection, "collectd_interface", "luci_statistics" )

-- collectd_interface.enable
enable = s:option( Flag, "enable", translate("Enable this plugin") )
enable.default = 0

-- collectd_interface.interfaces (Interface)
interfaces = s:option( MultiValue, "Interfaces", translate("Monitor interfaces") )
interfaces.widget = "select"
interfaces.size   = 5
interfaces:depends( "enable", 1 )
for k, v in pairs(luci.sys.net.devices()) do
	interfaces:value(v)
end

-- collectd_interface.ignoreselected (IgnoreSelected)
ignoreselected = s:option( Flag, "IgnoreSelected", translate("Monitor all except specified") )
ignoreselected.default = 0
ignoreselected:depends( "enable", 1 )

return m
