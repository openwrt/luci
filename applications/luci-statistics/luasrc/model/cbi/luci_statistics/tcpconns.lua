--[[

Luci configuration model for statistics - collectd tcpconns plugin configuration
(c) 2008 Freifunk Leipzig / Jo-Philipp Wich <xm@leipzig.freifunk.net>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

$Id$

]]--

m = Map("luci_statistics")

-- collectd_tcpconns config section
s = m:section( NamedSection, "collectd_tcpconns", "luci_statistics" )

-- collectd_tcpconns.enable
enable = s:option( Flag, "enable" )
enable.default = 0

-- collectd_tcpconns.listeningports (ListeningPorts)
listeningports = s:option( Flag, "ListeningPorts" )
listeningports.default = 1
listeningports:depends( "enable", 1 )

-- collectd_tcpconns.localports (LocalPort)
localports = s:option( Value, "LocalPorts" )
localports.optional = true
localports:depends( "enable", 1 )

-- collectd_tcpconns.remoteports (RemotePort)
remoteports = s:option( Value, "RemotePorts" )
remoteports.optional = true
remoteports:depends( "enable", 1 )

return m
