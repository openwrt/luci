-- ToDo: Translate, Add descriptions and help texts
m = Map("luci_fw", "Firewall", [[Mit Hilfe der Firewall können Zugriffe auf das Netzwerk
erlaubt, verboten oder umgeleitet werden.]])

s = m:section(TypedSection, "rule")
s.addremove = true
s.anonymous = true

chain = s:option(ListValue, "chain", "Kette")
chain:value("forward", "Forward")
chain:value("input", "Input")
chain:value("output", "Output")
chain:value("prerouting", "Prerouting")
chain:value("postrouting", "Postrouting")

iface = s:option(ListValue, "iface", "Eingangsschnittstelle")
iface.optional = true

oface = s:option(ListValue, "oface", "Ausgangsschnittstelle")
oface.optional = true

for k, v in pairs(luci.model.uci.sections("network")) do
	if v[".type"] == "interface" and k ~= "loopback" then
		iface:value(k)
		oface:value(k)
	end
end

proto = s:option(ListValue, "proto", "Protokoll")
proto.optional = true
proto:value("")
proto:value("tcp", "TCP")
proto:value("udp", "UDP")

s:option(Value, "source", "Quelladresse").optional = true
s:option(Value, "destination", "Zieladresse").optional = true
s:option(Value, "mac", "MAC-Adresse").optional = true

sport = s:option(Value, "sport", "Quellport")
sport.optional = true
sport:depends("proto", "tcp")
sport:depends("proto", "udp")

dport = s:option(Value, "dport", "Zielport")
dport.optional = true
dport:depends("proto", "tcp")
dport:depends("proto", "udp")

tosrc = s:option(Value, "tosrc", "Neue Quelladresse [SNAT]")
tosrc.optional = true
tosrc:depends("jump", "SNAT")

tosrc = s:option(Value, "todest", "Neue Zieladresse [DNAT]")
tosrc.optional = true
tosrc:depends("jump", "DNAT")

jump = s:option(ListValue, "jump", "Aktion")
jump.rmempty = true
jump:value("", "")
jump:value("ACCEPT", "annehmen (ACCEPT)")
jump:value("REJECT", "zurückweisen (REJECT)")
jump:value("DROP", "verwerfen (DROP)")
jump:value("LOG", "protokollieren (LOG)")
jump:value("DNAT", "Ziel umschreiben (DNAT) [nur Prerouting]")
jump:value("MASQUERADE", "maskieren (MASQUERADE) [nur Postrouting]")
jump:value("SNAT", "Quelle umschreiben (SNAT) [nur Postrouting]")


add = s:option(Value, "command", "Eigener Befehl")
add.size = 50
add.rmempty = true

return m
