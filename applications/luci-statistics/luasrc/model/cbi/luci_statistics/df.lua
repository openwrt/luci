--[[

Luci configuration model for statistics - collectd df plugin configuration
(c) 2008 Freifunk Leipzig / Jo-Philipp Wich <xm@leipzig.freifunk.net>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

$Id$

]]--

m = Map("luci_statistics", "DF Plugin",
[[Das DF-Plugin sammelt Informationen über den belegten und verfügbaren Speicherplatz auf den
angegebenen Geräten, Mountpunkten oder Dateisystemtypen.]])

-- collectd_df config section
s = m:section( NamedSection, "collectd_df", "luci_statistics", "Pluginkonfiguration" )

-- collectd_df.enable
enable = s:option( Flag, "enable", "Plugin aktivieren" )
enable.default = 0

-- collectd_df.devices (Device)
devices = s:option( Value, "Devices", "Gerätedateien", "Einträge mit Leerzeichen trennen" )
devices.default = "/dev/mtdblock/4"
devices.rmempty = true
devices:depends( "enable", 1 )

-- collectd_df.mountpoints (MountPoint)
mountpoints = s:option( Value, "MountPoints", "Mountpunkte", "Einträge mit Leerzeichen trennen" )
mountpoints.default = "/jffs"
mountpoints.rmempty = true
mountpoints:depends( "enable", 1 )

-- collectd_df.fstypes (FSType)
fstypes = s:option( Value, "FSTypes", "Dateisystemtypen", "Einträge mit Leerzeichen trennen" )
fstypes.default = "tmpfs"
fstypes.rmempty = true
fstypes:depends( "enable", 1 )

-- collectd_df.ignoreselected (IgnoreSelected)
ignoreselected = s:option( Flag, "IgnoreSelected", "Logik umkehren und alle Datenträger überwachen die nicht auf die obigen Kriterien zutreffen" )
ignoreselected.default = 0
ignoreselected:depends( "enable", 1 )

return m
