--[[

Luci configuration model for statistics - collectd dns plugin configuration
(c) 2008 Freifunk Leipzig / Jo-Philipp Wich <xm@leipzig.freifunk.net>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

$Id$

]]--

require("ffluci.model.uci")


m = Map("luci_statistics", "DNS Plugin",
[[Das DNS-Plugin nutzt die pcap Bibliothek um DNS-Verkehr zu analysieren.]])

-- collectd_dns config section
s = m:section( NamedSection, "collectd_dns", "luci_statistics", "Pluginkonfiguration" )

-- collectd_dns.enable
enable = s:option( Flag, "enable", "Plugin aktivieren" )
enable.default = 0

-- collectd_dns.interfaces (Interface)
interfaces = s:option( ListValue, "Interface", "Folgende Schnittstelle überwachen:" )
interfaces:depends( "enable", 1 )
interfaces:value("any")
for k, v in pairs(ffluci.model.uci.sections("network")) do
        if v[".type"] == "interface" and k ~= "loopback" then
                interfaces:value(k)
        end
end

-- collectd_dns.ignoresources (IgnoreSource)
ignoresources = s:option( Value, "IgnoreSources", "Verkehr von folgenden IP Adressen ignorieren:", "mehrere Einträge mit Leerzeichen trennen" )
ignoresources.default = "127.0.0.1"
ignoresources:depends( "enable", 1 )

return m
