m = Map("dhcp", "Dnsmasq")

s = m:section(TypedSection, "dnsmasq", "Einstellungen")
s.anonymous = true

s:option(Flag, "domainneeded", "Anfragen nur mit Domain", "Anfragen ohne Domainnamen nicht weiterleiten")
s:option(Flag, "authoritative", "Authoritativ", "Dies ist der einzige DHCP im lokalen Netz")
s:option(Flag, "boguspriv", "Private Anfragen filtern", "Reverse DNS-Anfragen für lokalen Netze nicht weiterleiten")
s:option(Flag, "filterwin2k", "Windowsanfragen filtern", "nutzlose DNS-Anfragen aktueller Windowssysteme filtern")
s:option(Flag, "localise", "Lokalisiere Anfragen", "Gibt die Adresse eines Hostnamen entsprechend seines Subnetzes zurück")
s:option(Value, "local", "Lokale Server")
s:option(Value, "domain", "Lokale Domain")
s:option(Flag, "expand_hosts", "Erweitere Hosts", "Fügt Domainnamen zu einfachen Hosteinträgen in der Resolvdatei hinzu")
s:option(Flag, "nonegcache", "Unbekannte nicht cachen", "Negative DNS-Antworten nicht zwischenspeichern")
s:option(Flag, "readethers", "Verwende /etc/ethers", "Lese Informationen aus /etc/ethers um den DHCP-Server zu konfigurieren")
s:option(Value, "leasefile", "Leasedatei", "Speicherort für vergebenen DHCP-Adressen")
s:option(Value, "resolvfile", "Resolvdatei", "Lokale DNS-Datei")

return m