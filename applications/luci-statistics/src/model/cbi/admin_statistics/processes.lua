--[[

Luci configuration model for statistics - collectd processes plugin configuration
(c) 2008 Freifunk Leipzig / Jo-Philipp Wich <xm@leipzig.freifunk.net>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

$Id$

]]--

m = Map("luci_statistics", "Processes Plugin",
[[Das Processes-Plugin sammelt Informationen über ausgewählte Prozesse auf diesem Gerät.]])

-- collectd_processes config section
s = m:section( NamedSection, "collectd_processes", "luci_statistics", "Pluginkonfiguration" )

-- collectd_processes.enable
enable = s:option( Flag, "enable", "Plugin aktivieren" )
enable.default = 0

-- collectd_processes.processs (Process)
processes = s:option( Value, "Processes", "Überwachte Prozesse", "mehrere mit Leerzeichen trennen" )
processes.default = "olsrd bmxd httpd dnsmasq dropbear tinc"
processes:depends( "enable", 1 )

return m
