-- General menu definition
add("public", "index", "Übersicht", 10)
act("contact", "Kontakt")


add("admin", "index", "Übersicht", 10)
act("luci", "FFLuCI")
act("contact", "Kontakt")

add("admin", "system", "System", 20)
act("packages", "Paketverwaltung")
act("passwd", "Passwort ändern")
act("sshkeys", "SSH-Schlüssel")
act("ipkg", "IPKG-Konfiguration")
act("reboot", "Neu starten")

add("admin", "network", "Netzwerk", 30)
act("vlan", "Switch")
act("ifaces", "Schnittstellen")
act("ptp", "PPPoE / PPTP")
act("routes", "Statische Routen")
act("portfw", "Portweiterleitung")
act("firewall", "Firewall")

add("admin", "wifi", "Drahtlos", 40)
act("devices", "Geräte")
act("networks", "Netze")

add("admin", "mesh", "Mesh", 50)
act("olsrd", "OLSR")