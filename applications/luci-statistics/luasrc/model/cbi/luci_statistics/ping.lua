--[[

Luci configuration model for statistics - collectd ping plugin configuration
(c) 2008 Freifunk Leipzig / Jo-Philipp Wich <xm@leipzig.freifunk.net>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

$Id$

]]--

m = Map("luci_statistics")

-- collectd_ping config section
s = m:section( NamedSection, "collectd_ping", "luci_statistics" )

-- collectd_ping.enable
enable = s:option( Flag, "enable" )
enable.default = 0

-- collectd_ping.hosts (Host)
hosts = s:option( Value, "Hosts" )
hosts.default = "127.0.0.1"
hosts:depends( "enable", 1 )

-- collectd_ping.ttl (TTL)
ttl = s:option( Value, "TTL" )
ttl.isinteger = true
ttl.default   = 128
ttl:depends( "enable", 1 )

return m
