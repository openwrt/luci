-- ToDo: Translate, Add descriptions and help texts
m = Map("luci_fw", "Portweiterleitung")

s = m:section(TypedSection, "portfw")
s.addremove = true
s.anonymous = true

iface = s:option(Value, "in_interface", "Externes Interface")

proto = s:option(ListValue, "proto", "Protokoll")
proto:value("tcp", "TCP")
proto:value("udp", "UDP")

dport = s:option(Value, "dport", "Externer Port", "Port[:Endport]")

to = s:option(Value, "to", "Interne Adresse", "IP-Adresse[:Zielport[-Zielendport]]")

return m