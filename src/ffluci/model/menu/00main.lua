-- General menu definition
add("public", "index", "Übersicht", 10)
act("contact", "Kontakt")


add("admin", "index", "Übersicht", 10)
act("contact", "Kontakt")
act("luci", "FFLuCI")

add("admin", "system", "System", 20)
act("packages", "Paketverwaltung")
act("passwd", "Passwort ändern")
act("sshkeys", "SSH-Schlüssel")
act("fstab", "Einhängepunkte")
act("reboot", "Neu starten")

add("admin", "services", "Dienste", 30)
act("olsrd", "OLSR")
act("httpd", "HTTP-Server")
act("dropbear", "SSH-Server")

add("admin", "network", "Netzwerk", 40)
act("vlan", "Switch")
act("ifaces", "Schnittstellen")
act("ptp", "PPPoE / PPTP")
act("routes", "Statische Routen")
act("portfw", "Portweiterleitung")
act("firewall", "Firewall")

add("admin", "wifi", "Drahtlos", 50)
act("devices", "Geräte")
act("networks", "Netze")