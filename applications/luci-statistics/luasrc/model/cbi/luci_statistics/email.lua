--[[

Luci configuration model for statistics - collectd email plugin configuration
(c) 2008 Freifunk Leipzig / Jo-Philipp Wich <xm@leipzig.freifunk.net>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

$Id$

]]--

m = Map("luci_statistics", "E-Mail Plugin",
[[Das E-Mail-Plugin öffnet einen Unix-Socket über welchen E-Mail Statistiken an collectd
übergeben werden können. Dieses Plugin ist primär für die Verwendung mit
Mail::SpamAssassin::Plugin::Collectd gedacht, lässt sich aber auch anderweitig einsetzen.]])

-- collectd_email config section
s = m:section( NamedSection, "collectd_email", "luci_statistics", "Pluginkonfiguration" )

-- collectd_email.enable
enable = s:option( Flag, "enable", "Plugin aktivieren" )
enable.default = 0

-- collectd_email.socketfile (SocketFile)
socketfile = s:option( Value, "SocketFile", "Pfad für den Unix-Socket" )
socketfile.default = "/var/run/collect-email.sock"
socketfile:depends( "enable", 1 )

-- collectd_email.socketgroup (SocketGroup)
socketgroup = s:option( Value, "SocketGroup", "Dateibesitzergruppe für den Unix-Socket ändern" )
socketgroup.default  = "nobody"
socketgroup.rmempty  = true
socketgroup.optional = true
socketgroup:depends( "enable", 1 )

-- collectd_email.socketperms (SocketPerms)
socketperms = s:option( Value, "SocketPerms", "Dateiberechtigungen für den Unix-Socket ändern" )
socketperms.default  = "0770"
socketperms.rmempty  = true
socketperms.optional = true
socketperms:depends( "enable", 1 )

-- collectd_email.maxconns (MaxConns)
maxconns = s:option( Value, "MaxConns", "Maximale Anzahl paralleler Verbindungen", "Werte von 1 bis 16384" )
maxconns.default   = 5
maxconns.isinteger = true
maxconns.rmempty   = true
maxconns.optional  = true
maxconns:depends( "enable", 1 )

return m
