--[[

Luci configuration model for statistics - collectd disk plugin configuration
(c) 2008 Freifunk Leipzig / Jo-Philipp Wich <xm@leipzig.freifunk.net>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

$Id$

]]--

m = Map("luci_statistics", "Disk Plugin",
[[Das Disk-Plugin sammelt Informationen über Augewählte Fesplatten.]])

-- collectd_disk config section
s = m:section( NamedSection, "collectd_disk", "luci_statistics", "Pluginkonfiguration" )

-- collectd_disk.enable
enable = s:option( Flag, "enable", "Plugin aktivieren" )
enable.default = 0

-- collectd_disk.disks (Disk)
devices = s:option( Value, "Disks", "Fesplatten oder Partitionen", "Einträge mit Leerzeichen trennen" )
devices.default = "hda1 hdb"
devices.rmempty = true
devices:depends( "enable", 1 )

-- collectd_disk.ignoreselected (IgnoreSelected)
ignoreselected = s:option( Flag, "IgnoreSelected", "Logik umkehren und alle Datenträger und Partitionen überwachen die nicht auf die obigen Kriterien zutreffen" )
ignoreselected.default = 0
ignoreselected:depends( "enable", 1 )

return m
