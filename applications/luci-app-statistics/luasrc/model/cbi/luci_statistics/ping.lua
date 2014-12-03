--[[

Luci configuration model for statistics - collectd ping plugin configuration
(c) 2008 Freifunk Leipzig / Jo-Philipp Wich <xm@leipzig.freifunk.net>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

$Id$

]]--

m = Map("luci_statistics",
	translate("Ping Plugin Configuration"),
	translate(
		"The ping plugin will send icmp echo replies to selected " ..
		"hosts and measure the roundtrip time for each host."
	))

-- collectd_ping config section
s = m:section( NamedSection, "collectd_ping", "luci_statistics" )

-- collectd_ping.enable
enable = s:option( Flag, "enable", translate("Enable this plugin") )
enable.default = 0

-- collectd_ping.hosts (Host)
hosts = s:option( Value, "Hosts", translate("Monitor hosts"), translate ("Add multiple hosts separated by space."))
hosts.default = "127.0.0.1"
hosts:depends( "enable", 1 )

-- collectd_ping.ttl (TTL)
ttl = s:option( Value, "TTL", translate("TTL for ping packets") )
ttl.isinteger = true
ttl.default   = 128
ttl:depends( "enable", 1 )

-- collectd_ping.interval (Interval)
interval = s:option( Value, "Interval", translate("Interval for pings"), translate ("Seconds") )
interval.isinteger = true
interval.default   = 30
interval:depends( "enable", 1 )

return m
