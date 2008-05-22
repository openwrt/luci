-- Todo: Translate
m = Map("freifunk", "Freifunk")

c = m:section(NamedSection, "community", "public", "Gemeinschaft", [[Dies sind die Grundeinstellungen
für die lokale Freifunkgemeinschaft. Diese Werte wirken sich NICHT auf die Konfiguration
des Routers aus, sondern definieren nur die Vorgaben für den Freifunkassistenten.]])
c:option(Value, "name", "Gemeinschaft")
c:option(Value, "homepage", "Webseite")
c:option(Value, "essid", "ESSID")
c:option(Value, "bssid", "BSSID")
c:option(Value, "channel", "Funkkanal")
c:option(Value, "realm", "Realm")
c:option(Value, "net", "Adressbereich")
c:option(Value, "mask", "Netzmaske")
c:option(Value, "dns", "DNS-Server")
c:option(Value, "dhcp", "DHCP-Bereich")
c:option(Value, "dhcpmask", "DHCP-Maske")

return m