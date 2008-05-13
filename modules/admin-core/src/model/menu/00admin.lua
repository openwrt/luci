add("admin", "index", "Übersicht", 10)
act("luci", "Oberfläche")

add("admin", "status", "Status", 20)
act("syslog", "Systemprotokoll")

add("admin", "system", "System", 30)
act("packages", "Paketverwaltung")
act("passwd", "Passwort ändern")
act("sshkeys", "SSH-Schlüssel")
act("hostname", "Hostname")
act("fstab", "Einhängepunkte")
act("upgrade", "Firmwareupgrade")
act("reboot", "Neu starten")

add("admin", "services", "Dienste", 40)
if isfile("/etc/config/olsr") then
	act("olsrd", "OLSR")
end
act("httpd", "HTTP-Server")
act("dropbear", "SSH-Server")
act("dnsmasq", "Dnsmasq")

add("admin", "network", "Netzwerk", 50)
act("vlan", "Switch")
act("ifaces", "Schnittstellen")
act("dhcp", "DHCP-Server")
act("ptp", "PPPoE / PPTP")
act("routes", "Statische Routen")
if isfile("/etc/config/qos") then
	act("qos", "Quality of Service")
end

add("admin", "wifi", "Drahtlos", 60)
act("devices", "Geräte")
act("networks", "Netze")