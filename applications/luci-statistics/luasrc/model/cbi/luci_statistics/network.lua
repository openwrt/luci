--[[

Luci configuration model for statistics - collectd network plugin configuration
(c) 2008 Freifunk Leipzig / Jo-Philipp Wich <xm@leipzig.freifunk.net>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

$Id$

]]--


m = Map("luci_statistics", "Network Plugin",
[[Das Network-Plugin ermöglicht den netzwerkgestützen Austausch von Statistikdaten.]])

-- collectd_network config section
s = m:section( NamedSection, "collectd_network", "luci_statistics", "Pluginkonfiguration" )

-- collectd_network.enable
enable = s:option( Flag, "enable", "Plugin aktivieren" )
enable.default = 0


-- collectd_network_listen config section (Listen)
listen = m:section( TypedSection, "collectd_network_listen", "Schnittstellen für eingehende Verbindungen",
[[Legt fest auf welchen Schnittstellen bzw. IP-Adressen collectd auf eingehende Verbindungen wartet.]])
listen.addremove = true
listen.anonymous = true


-- collectd_network_listen.host
listen_host = listen:option( Value, "host", "Listen-Host", "Host-, IP- oder IPv6-Adresse" )
listen_host.default = "0.0.0.0"

-- collectd_network_listen.port
listen_port = listen:option( Value, "port", "Listen-Port", "Partnummer 0 - 65535" )
listen_port.default   = 25826
listen_port.isinteger = true
listen_port.optional  = true


-- collectd_network_server config section (Server)
server = m:section( TypedSection, "collectd_network_server", "Schnittstellen für ausgehende Verbindungen",
[[Legt fest auf welchen Schnittstellen bzw. IP-Adressen collectd als Server agiert.]])
server.addremove = true
server.anonymous = true


-- collectd_network_server.host
server_host = server:option( Value, "host", "Server-Host", "Host-, IP- oder IPv6-Adresse" )
server_host.default = "0.0.0.0"

-- collectd_network_server.port
server_port = server:option( Value, "port", "Server-Port", "Partnummer 0 - 65535" )
server_port.default   = 25826
server_port.isinteger = true
server_port.optional  = true

-- collectd_network.timetolive (TimeToLive)
ttl = s:option( Value, "TimeToLive", "Time-to-Live für die Pakete", "Werte 0 bis 255" )
ttl.default   = 128
ttl.isinteger = true
ttl.optional  = true
ttl:depends( "enable", 1 )

-- collectd_network.forward (Forward)
forward = s:option( Flag, "Forward", "Weiterleitung zwischen verschiedenen Listen- und Server-Adressen" )
forward.default  = 0
forward.optional = true
forward:depends( "enable", 1 )

-- collectd_network.forward (CacheFlush)
forward = s:option( Value, "CacheFlush", "Löschintervall für temporäre Daten", "in Sekunden" )
forward.default   = 86400
forward.isinteger = true
forward.optional  = true
forward:depends( "enable", 1 )


return m
