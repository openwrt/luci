--[[

Luci configuration model for statistics - collectd unixsock plugin configuration
(c) 2008 Freifunk Leipzig / Jo-Philipp Wich <xm@leipzig.freifunk.net>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

$Id$

]]--

m = Map("luci_statistics", "Unixsock Plugin",
[[Das Unixsock-Plugin öffnet einen Socket über welchen die gesammelten Werte des
laufenden collectd Prozesses abgefragt werden können.]])

-- collectd_unixsock config section
s = m:section( NamedSection, "collectd_unixsock", "luci_statistics", "Pluginkonfiguration" )

-- collectd_unixsock.enable
enable = s:option( Flag, "enable", "Plugin aktivieren" )
enable.default = 0

-- collectd_unixsock.socketfile (SocketFile)
socketfile = s:option( Value, "SocketFile", "Pfad für den Unix-Socket" )
socketfile.default = "/var/run/collect-query.socket"
socketfile:depends( "enable", 1 )

-- collectd_unixsock.socketgroup (SocketGroup)
socketgroup = s:option( Value, "SocketGroup", "Dateibesitzergruppe für den Unix-Socket ändern" )
socketgroup.default  = "nobody"
socketgroup.rmempty  = true
socketgroup.optional = true
socketgroup:depends( "enable", 1 )

-- collectd_unixsock.socketperms (SocketPerms)
socketperms = s:option( Value, "SocketPerms", "Dateiberechtigungen für den Unix-Socket ändern" )
socketperms.default  = "0770"
socketperms.rmempty  = true
socketperms.optional = true
socketperms:depends( "enable", 1 )

return m
