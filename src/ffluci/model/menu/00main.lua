-- General menu definition
add("public", "index", "Übersicht", 10)
act("contact", "Kontakt")


add("admin", "index", "Übersicht", 10)
act("contact", "Kontakt")
act("luci", "FFLuCI")

add("admin", "status", "Status", 20)
act("system", "System")

add("admin", "system", "System", 30)
act("packages", "Paketverwaltung")
act("passwd", "Passwort ändern")
act("sshkeys", "SSH-Schlüssel")
act("fstab", "Einhängepunkte")
act("upgrade", "Firmwareupgrade")
act("reboot", "Neu starten")

add("admin", "services", "Dienste", 40)
act("olsrd", "OLSR")
act("httpd", "HTTP-Server")
act("dropbear", "SSH-Server")
act("dnsmasq", "Dnsmasq")

add("admin", "network", "Netzwerk", 50)
act("vlan", "Switch")
act("ifaces", "Schnittstellen")
act("dhcp", "DHCP-Server")
act("ptp", "PPPoE / PPTP")
act("routes", "Statische Routen")
act("portfw", "Portweiterleitung")
act("firewall", "Firewall")

add("admin", "wifi", "Drahtlos", 60)
act("devices", "Geräte")
act("networks", "Netze")