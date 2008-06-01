--[[

Luci configuration model for statistics - collectd netlink plugin configuration
(c) 2008 Freifunk Leipzig / Jo-Philipp Wich <xm@leipzig.freifunk.net>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

$Id$

]]--

require("luci.sys")

local devices = luci.sys.net.devices()


m = Map("luci_statistics")

-- collectd_netlink config section
s = m:section( NamedSection, "collectd_netlink", "luci_statistics" )

-- collectd_netlink.enable
enable = s:option( Flag, "enable" )
enable.default = 0

-- collectd_netlink.interfaces (Interface)
interfaces = s:option( MultiValue, "Interfaces" )
interfaces.widget   = "select"
interfaces.optional = true
interfaces.size     = #devices + 1
interfaces:depends( "enable", 1 )
interfaces:value("")
for i, v in ipairs(devices) do
	interfaces:value(v)
end

-- collectd_netlink.verboseinterfaces (VerboseInterface)
verboseinterfaces = s:option( MultiValue, "VerboseInterfaces" )
verboseinterfaces.widget   = "select"
verboseinterfaces.optional = true
verboseinterfaces.size     = #devices + 1
verboseinterfaces:depends( "enable", 1 )
verboseinterfaces:value("")
for i, v in ipairs(devices) do
	verboseinterfaces:value(v)
end

-- collectd_netlink.qdiscs (QDisc)
qdiscs = s:option( MultiValue, "QDiscs" )
qdiscs.widget   = "select"
qdiscs.optional = true
qdiscs.size     = #devices + 1
qdiscs:depends( "enable", 1 )
qdiscs:value("")
for i, v in ipairs(devices) do
        qdiscs:value(v)
end

-- collectd_netlink.classes (Class)
classes = s:option( MultiValue, "Classes" )
classes.widget   = "select"
classes.optional = true
classes.size     = #devices + 1
classes:depends( "enable", 1 )
classes:value("")
for i, v in ipairs(devices) do
        classes:value(v)
end

-- collectd_netlink.filters (Filter)
filters = s:option( MultiValue, "Filters" )
filters.widget   = "select"
filters.optional = true
filters.size     = #devices + 1
filters:depends( "enable", 1 )
filters:value("")
for i, v in ipairs(devices) do
        filters:value(v)
end

-- collectd_netlink.ignoreselected (IgnoreSelected)
ignoreselected = s:option( Flag, "IgnoreSelected" )
ignoreselected.default = 0
ignoreselected:depends( "enable", 1 )

return m
