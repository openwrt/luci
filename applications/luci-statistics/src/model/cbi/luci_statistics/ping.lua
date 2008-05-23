--[[

Luci configuration model for statistics - collectd ping plugin configuration
(c) 2008 Freifunk Leipzig / Jo-Philipp Wich <xm@leipzig.freifunk.net>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

$Id$

]]--

m = Map("luci_statistics", "Ping Plugin",
[[Das Ping-Plugin veranlasst periodische ICMP-Requests an die angegebenen Adressen und zeichnet
Parameter wie Verfügbarkeit und Antwortzeiten auf.]])

-- collectd_ping config section
s = m:section( NamedSection, "collectd_ping", "luci_statistics", "Pluginkonfiguration" )

-- collectd_ping.enable
enable = s:option( Flag, "enable", "Plugin aktivieren" )
enable.default = 0

-- collectd_ping.hosts (Host)
hosts = s:option( Value, "Hosts", "Zieladressen", "Einträge durch Leerzeichen trennen" )
hosts.default = "127.0.0.1"
hosts:depends( "enable", 1 )

-- collectd_ping.ttl (TTL)
ttl = s:option( Value, "TTL", "Time-to-Live für die ICMP-Pakete (Werte 0 bis 255)" )
ttl.isinteger = true
ttl.default   = 128
ttl:depends( "enable", 1 )

return m
