--[[

Luci configuration model for statistics - collectd ping plugin configuration
(c) 2008 Freifunk Leipzig / Jo-Philipp Wich <xm@leipzig.freifunk.net>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

$Id$

]]--

m = Map("luci_statistics", "Tcpconns Plugin",
[[Das Tcpconns-Plugin zählt TCP-Verbindungen auf einzelnen Ports.]])

-- collectd_tcpconns config section
s = m:section( NamedSection, "collectd_tcpconns", "luci_statistics", "Pluginkonfiguration" )

-- collectd_tcpconns.enable
enable = s:option( Flag, "enable", "Plugin aktivieren" )
enable.default = 0

-- collectd_tcpconns.listeningports (ListeningPorts)
listeningports = s:option( Flag, "ListeningPorts", "Alle von lokalen Diensten genutzen Ports überwachen" )
listeningports.default = 1
listeningports:depends( "enable", 1 )

-- collectd_tcpconns.localports (LocalPort)
localports = s:option( Value, "LocalPorts", "Lokale Ports", "mit Leerzeichen trennen" )
localports.optional = true
localports:depends( "enable", 1 )

-- collectd_tcpconns.remoteports (RemotePort)
remoteports = s:option( Value, "RemotePorts", "Entfernte Ports", "mit Leerzeichen trennen" )
remoteports.optional = true
remoteports:depends( "enable", 1 )

return m
