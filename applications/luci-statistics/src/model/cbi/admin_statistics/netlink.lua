--[[

Luci configuration model for statistics - collectd netlink plugin configuration
(c) 2008 Freifunk Leipzig / Jo-Philipp Wich <xm@leipzig.freifunk.net>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

$Id$

]]--

require("ffluci.sys")


m = Map("luci_statistics", "Interface Plugin",
[[Das Netlink-Plugin sammelt erweiterte Informationen wie Qdisc-, Class- und Filter-Werten auf einzelnen Schnittstellen.]])

-- collectd_netlink config section
s = m:section( NamedSection, "collectd_netlink", "luci_statistics", "Pluginkonfiguration" )

-- collectd_netlink.enable
enable = s:option( Flag, "enable", "Plugin aktivieren" )
enable.default = 0

-- collectd_netlink.interfaces (Interface)
interfaces = s:option( MultiValue, "Interfaces", "einfach Überwachte Schnittstellen", "mehrere Einträge mit Strg selektieren" )
interfaces.widget   = "select"
interfaces.optional = true
interfaces:depends( "enable", 1 )
interfaces:value("")
for i, v in ipairs(ffluci.sys.net.devices()) do
	interfaces:value(v)
end

-- collectd_netlink.verboseinterfaces (VerboseInterface)
verboseinterfaces = s:option( MultiValue, "VerboseInterfaces", "detailliert Überwachte Schnittstellen", "mehrere Einträge mit Strg selektieren" )
verboseinterfaces.widget   = "select"
verboseinterfaces.optional = true
verboseinterfaces:depends( "enable", 1 )
verboseinterfaces:value("")
for i, v in ipairs(ffluci.sys.net.devices()) do
	verboseinterfaces:value(v)
end

-- collectd_netlink.qdiscs (QDisc)
qdiscs = s:option( MultiValue, "QDiscs", "Queue Discipline auf Schnittstellen Überwachen", "mehrere Einträge mit Strg selektieren" )
qdiscs.widget   = "select"
qdiscs.optional = true
qdiscs:depends( "enable", 1 )
qdiscs:value("")
for i, v in ipairs(ffluci.sys.net.devices()) do
        qdiscs:value(v)
end

-- collectd_netlink.classes (Class)
classs = s:option( MultiValue, "Classes", "Shapingklassen auf Schnittstellen Überwachen", "mehrere Einträge mit Strg selektieren" )
classs.widget   = "select"
classs.optional = true
classs:depends( "enable", 1 )
classs:value("")
for i, v in ipairs(ffluci.sys.net.devices()) do
        classs:value(v)
end

-- collectd_netlink.filters (Filter)
filters = s:option( MultiValue, "Filters", "Filterklassen auf Schnittstellen Überwachen", "mehrere Einträge mit Strg selektieren" )
filters.widget   = "select"
filters.optional = true
filters:depends( "enable", 1 )
filters:value("")
for i, v in ipairs(ffluci.sys.net.devices()) do
        filters:value(v)
end

-- collectd_netlink.ignoreselected (IgnoreSelected)
ignoreselected = s:option( Flag, "IgnoreSelected", "Alle Schnittstellen außer ausgewählte überwachen" )
ignoreselected.default = 0
ignoreselected:depends( "enable", 1 )

return m
