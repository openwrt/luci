m = Map("dhcp", "Dnsmasq", "Dnsmasq ist ein kombinierter DHCP-Server und DNS-Forwarder für NAT-Firewalls.")

s = m:section(TypedSection, "dnsmasq", "Einstellungen")
s.anonymous = true

s:option(Flag, "domainneeded", "Anfragen nur mit Domain", "Anfragen ohne Domainnamen nicht weiterleiten")
s:option(Flag, "authoritative", "Authoritativ", "Dies ist der einzige DHCP im lokalen Netz")
s:option(Flag, "boguspriv", "Private Anfragen filtern", "Reverse DNS-Anfragen für lokalen Netze nicht weiterleiten")
s:option(Flag, "filterwin2k", "Windowsanfragen filtern", "nutzlose DNS-Anfragen aktueller Windowssysteme filtern")
s:option(Flag, "localise_queries", "Lokalisiere Anfragen", "Gibt die Adresse eines Hostnamen entsprechend seines Subnetzes zurück")
s:option(Value, "local", "Lokale Server")
s:option(Value, "domain", "Lokale Domain")
s:option(Flag, "expandhosts", "Erweitere Hosts", "Fügt Domainnamen zu einfachen Hosteinträgen in der Resolvdatei hinzu")
s:option(Flag, "nonegcache", "Unbekannte nicht cachen", "Negative DNS-Antworten nicht zwischenspeichern")
s:option(Flag, "readethers", "Verwende /etc/ethers", "Lese Informationen aus /etc/ethers um den DHCP-Server zu konfigurieren")
s:option(Value, "leasefile", "Leasedatei", "Speicherort für vergebenen DHCP-Adressen")
s:option(Value, "resolvfile", "Resolvdatei", "Lokale DNS-Datei")
s:option(Flag, "nohosts", "Ignoriere /etc/hosts").optional = true
s:option(Flag, "strictorder", "Strikte Reihenfolge", "DNS-Server werden strikt der Reihenfolge in der Resolvdatei nach abgefragt").optional = true
s:option(Flag, "logqueries", "Schreibe Abfragelog").optional = true
s:option(Flag, "noresolv", "Ignoriere Resolvdatei").optional = true
s:option(Value, "dnsforwardmax", "gleichzeitige Abfragen").optional = true
s:option(Value, "port", "DNS-Port").optional = true
s:option(Value, "ednspacket_max", "max. EDNS.0 Paketgröße").optional = true
s:option(Value, "dhcpleasemax", "max. DHCP-Leases").optional = true
s:option(Value, "addnhosts", "Zusätzliche Hostdatei").optional = true
s:option(Value, "queryport", "Abfrageport").optional = true

return m