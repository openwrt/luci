fw_fw1 = [[Mit Hilfe der Firewall können Zugriffe auf das Netzwerk
erlaubt, verboten oder umgeleitet werden.]]
lucifw_rule_chain = "Kette"
lucifw_rule_iface = "Eingangsschnittstelle"
lucifw_rule_oface = "Ausgangsschnittstelle"
lucifw_rule_source = "Quelladresse"
lucifw_rule_destination = "Zieladresse"
lucifw_rule_mac = "MAC-Adresse"
lucifw_rule_sport = "Quellport"
lucifw_rule_dport = "Zielport"
lucifw_rule_tosrc = "Neue Quelladresse [SNAT]"
lucifw_rule_todest = "Neue Zieladresse [DNAT]" 
lucifw_rule_jump = "Aktion"
lucifw_rule_command = "Eigener Befehl"
fw_accept = "annehmen (ACCEPT)"
fw_reject = "zurückweisen (REJECT)"
fw_drop = "verwerfen (DROP)"
fw_log = "protokollieren (LOG)"
fw_dnat = "Ziel umschreiben (DNAT) [nur Prerouting]"
fw_masq = "maskieren (MASQUERADE) [nur Postrouting]"
fw_snat = "Quelle umschreiben (SNAT) [nur Postrouting]"

fw_portfw1 = [[Portweiterleitungen ermöglichen es interne
Netzwerkdienste von einem anderen externen Netzwerk aus erreichbar zu machen.]]
lucifw_portfw_iface_desc = "Externe Schnittstelle"
lucifw_portfw_dport = "Externer Port"
lucifw_portfw_dport_desc = "Port[:Endport]"
lucifw_portfw_to = "Interne Adresse"
lucifw_portfw_to_desc = "IP-Adresse[:Zielport[-Zielendport]]"

fw_routing1 = [[An dieser Stelle wird festlegt, welcher Netzverkehr zwischen einzelnen
Schnittstellen erlaubt werden soll. Es werden jeweils nur neue Verbindungen
betrachtet, d.h. Pakete von aufgebauten oder zugehörigen Verbindungen werden automatisch in beide Richtungen
akzeptiert, auch wenn das Feld "beide Richtungen" nicht explizit gesetzt ist.
NAT ermöglicht Adressübersetzung.]]
lucifw_routing_iface = "Eingang"
lucifw_routing_iface_desc = lucifw_rule_iface
lucifw_routing_oface = "Ausgang" 
lucifw_routing_oface_desc = lucifw_rule_oface
lucifw_routing_fwd_desc = "weiterleiten"
lucifw_routing_nat_desc = "übersetzen"
lucifw_routing_bidi_desc = "beide Richtungen"