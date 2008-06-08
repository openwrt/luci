dhcp_desc = "Dnsmasq ist ein kombinierter DHCP-Server und DNS-Forwarder für NAT-Firewalls."
dhcp_dnsmasq_domainneeded = "Anfragen nur mit Domain"
dhcp_dnsmasq_domainneeded_desc = "Anfragen ohne Domainnamen nicht weiterleiten"
dhcp_dnsmasq_authoritative = "Authoritativ"
dhcp_dnsmasq_authoritative_desc = "Dies ist der einzige DHCP im lokalen Netz"
dhcp_dnsmasq_boguspriv = "Private Anfragen filtern"
dhcp_dnsmasq_boguspriv_desc = "Reverse DNS-Anfragen für lokale Netze nicht weiterleiten"
dhcp_dnsmasq_filterwin2k = "Windowsanfragen filtern"
dhcp_dnsmasq_filterwin2k_desc = "nutzlose DNS-Anfragen aktueller Windowssysteme filtern"
dhcp_dnsmasq_localisequeries = "Lokalisiere Anfragen"
dhcp_dnsmasq_localisequeries_desc = "Gibt die Adresse eines Hostnamen entsprechend seines Subnetzes zurück"
dhcp_dnsmasq_local = "Lokale Server"
dhcp_dnsmasq_domain = "Lokale Domain"
dhcp_dnsmasq_expandhosts = "Erweitere Hosts"
dhcp_dnsmasq_expandhosts_desc = "Fügt Domainnamen zu einfachen Hosteinträgen in der Resolvdatei hinzu"
dhcp_dnsmasq_nonegcache = "Unbekannte nicht cachen"
dhcp_dnsmasq_nonegcache_desc = "Negative DNS-Antworten nicht zwischenspeichern"
dhcp_dnsmasq_readethers = "Verwende /etc/ethers"
dhcp_dnsmasq_readethers_desc = "Lese Informationen aus /etc/ethers um den DHCP-Server zu konfigurieren" 
dhcp_dnsmasq_leasefile = "Leasedatei"
dhcp_dnsmasq_leasefile_desc = "Speicherort für vergebenen DHCP-Adressen"
dhcp_dnsmasq_resolvfile = "Resolvdatei"
dhcp_dnsmasq_resolvfile_desc = "Lokale DNS-Datei"
dhcp_dnsmasq_nohosts = "Ignoriere /etc/hosts"
dhcp_dnsmasq_strictorder = "Strikte Reihenfolge"
dhcp_dnsmasq_strictorder_desc = "DNS-Server werden strikt der Reihenfolge in der Resolvdatei nach abgefragt"
dhcp_dnsmasq_logqueries = "Schreibe Abfragelog"
dhcp_dnsmasq_noresolv = "Ignoriere Resolvdatei"
dhcp_dnsmasq_dnsforwardmax = "gleichzeitige Abfragen"
dhcp_dnsmasq_port = "DNS-Port"
dhcp_dnsmasq_ednspacket_max = "max. EDNS.0 Paketgröße"
dhcp_dnsmasq_dhcpleasemax = "max. DHCP-Leases"
dhcp_dnsmasq_addnhosts = "Zusätzliche Hostdatei"
dhcp_dnsmasq_queryport = "Abfrageport"


a_n_switch1 = [[Die Netzwerkschnittstellen am Router
können zu verschienden VLANs zusammengefasst werden, in denen Geräte miteinander direkt
kommunizieren können. VLANs werden auch häufig dazu genutzt, um Netzwerke voneiander zu trennen.
So ist oftmals eine Schnittstelle als Uplink zu einem größerem Netz, wie dem Internet vorkonfiguriert
und die anderen Schnittstellen bilden ein VLAN für das lokale Netzwerk.]]

network_switch_desc = [[Die zu einem VLAN gehörenden Schnittstellen
werden durch Leerzeichen getrennt. Die Schnittstelle mit der höchsten Nummer (meistens 5) bildet
in der Regel die Verbindung zur internen Netzschnittstelle des Routers. Bei Geräten mit 5 Schnittstellen
ist in der Regel die Schnittstelle mit der niedrigsten Nummer (0) die standardmäßige Uplinkschnittstelle des Routers.]]

a_n_ifaces1 = [[An dieser Stelle können die einzelnen Schnittstellen 
des Netzwerkes konfiguriert werden. Es können mehrere Schnittstellen zu einer Brücke zusammengefasst werden,
indem diese durch Leerzeichen getrennt aufgezählt werden und ein entsprechender Haken im Feld Netzwerkbrücke
gesetzt wird. Es können VLANs in der Notation SCHNITTSTELLE.VLANNR (z.B.: eth0.1) verwendet werden.]]
a_n_i_bridge = "Netzwerkbrücke"
a_n_i_bridge1 = "überbrückt angegebene Schnittstelle(n)"

dhcp_desc = [[Mit Hilfe von DHCP können Netzteilnehmer automatisch
ihre Netzwerkkonfiguration (IP-Adresse, Netzmaske, DNS-Server, ...) beziehen.]]
dhcp_dhcp_leasetime = "Laufzeit"
dhcp_dhcp_dynamicdhcp = "Dynamisches DHCP"
dhcp_dhcp_ignore = "Schnittstelle ignorieren"
dhcp_dhcp_ignore_desc = "DHCP für dieses Netzwerk deaktivieren"
dhcp_dhcp_force = "Start erzwingen"
dhcp_dhcp_start_desc = "Erste vergebene Adresse (letztes Oktett)"
dhcp_dhcp_limit_desc = "Anzahl zu vergebender Adressen -1"

a_n_ptp = "Punkt-zu-Punkt Verbindungen"
a_n_ptp1 = [[Punkt-zu-Punkt Verbindungen
über PPPoE oder PPTP werden häufig dazu verwendet, um über DSL o.ä. Techniken eine
Verbindung zum Internetgateway eines Internetzugangsanbieters aufzubauen.]]
network_interface_server = "PPTP-Server"
network_interface_demand = "Automatische Trennung"
network_interface_demand_desc = "Zeit nach der die Verbindung bei Inaktivität getrennt wird"
network_interface_keepalive = "Keep-Alive"
network_interface_keepalive_desc = "Bei einer Verbindungstrennung automatisch neu verbinden"

a_n_routes = "Statische Routen"
a_n_routes1 = [[Statische Routen geben an,
über welche Schnittstelle und welches Gateway ein bestimmter Host
oder ein bestimmtes Netzwerk erreicht werden kann.]]
a_n_r_target1 = "Host-IP oder Netzwerk"
a_n_r_netmask1 = "falls Ziel ein Netzwerk ist"