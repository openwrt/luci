--[[

Luci configuration model for statistics - collectd disk plugin configuration
(c) 2008 Freifunk Leipzig / Jo-Philipp Wich <xm@leipzig.freifunk.net>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

$Id$

]]--

m = Map("luci_statistics")

-- collectd_disk config section
s = m:section( NamedSection, "collectd_disk", "luci_statistics" )

-- collectd_disk.enable
enable = s:option( Flag, "enable" )
enable.default = 0

-- collectd_disk.disks (Disk)
devices = s:option( Value, "Disks" )
devices.default = "hda1 hdb"
devices.rmempty = true
devices:depends( "enable", 1 )

-- collectd_disk.ignoreselected (IgnoreSelected)
ignoreselected = s:option( Flag, "IgnoreSelected" )
ignoreselected.default = 0
ignoreselected:depends( "enable", 1 )

return m
