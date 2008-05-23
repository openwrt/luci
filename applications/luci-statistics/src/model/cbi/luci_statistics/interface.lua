--[[

Luci configuration model for statistics - collectd interface plugin configuration
(c) 2008 Freifunk Leipzig / Jo-Philipp Wich <xm@leipzig.freifunk.net>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

$Id$

]]--

require("ffluci.sys")


m = Map("luci_statistics", "Interface Plugin",
[[Das Interface-Plugin sammelt Informationen zum Netzwerkverkehr auf den einzelnen Schnittstellen.]])

-- collectd_interface config section
s = m:section( NamedSection, "collectd_interface", "luci_statistics", "Pluginkonfiguration" )

-- collectd_interface.enable
enable = s:option( Flag, "enable", "Plugin aktivieren" )
enable.default = 0

-- collectd_interface.interfaces (Interface)
interfaces = s:option( MultiValue, "Interfaces", "Überwachte Schnittstellen", "mehrere Einträge mit Strg selektieren" )
interfaces.widget = "select"
interfaces:depends( "enable", 1 )
for k, v in pairs(ffluci.sys.net.devices()) do
	interfaces:value(v)
end

-- collectd_interface.ignoreselected (IgnoreSelected)
ignoreselected = s:option( Flag, "IgnoreSelected", "Alle Schnittstellen außer ausgewählte überwachen" )
ignoreselected.default = 0
ignoreselected:depends( "enable", 1 )

return m
