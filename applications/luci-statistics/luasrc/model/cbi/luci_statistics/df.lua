--[[

Luci configuration model for statistics - collectd df plugin configuration
(c) 2008 Freifunk Leipzig / Jo-Philipp Wich <xm@leipzig.freifunk.net>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

$Id$

]]--

m = Map("luci_statistics")

-- collectd_df config section
s = m:section( NamedSection, "collectd_df", "luci_statistics" )

-- collectd_df.enable
enable = s:option( Flag, "enable" )
enable.default = 0

-- collectd_df.devices (Device)
devices = s:option( Value, "Devices" )
devices.default  = "/dev/mtdblock/4"
devices.optional = true
devices:depends( "enable", 1 )

-- collectd_df.mountpoints (MountPoint)
mountpoints = s:option( Value, "MountPoints" )
mountpoints.default  = "/jffs"
mountpoints.optional = true
mountpoints:depends( "enable", 1 )

-- collectd_df.fstypes (FSType)
fstypes = s:option( Value, "FSTypes" )
fstypes.default  = "tmpfs"
fstypes.optional = true
fstypes:depends( "enable", 1 )

-- collectd_df.ignoreselected (IgnoreSelected)
ignoreselected = s:option( Flag, "IgnoreSelected" )
ignoreselected.default = 0
ignoreselected:depends( "enable", 1 )

return m
