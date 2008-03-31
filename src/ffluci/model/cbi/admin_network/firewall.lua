-- ToDo: Translate, Add descriptions and help texts
m = Map("luci_fw", "Firewall")

s = m:section(TypedSection, "rule")
s.addremove = true

chain = s:option(ListValue, "chain", "Kette")
chain:value("forward", "Forward")
chain:value("input", "Input")
chain:value("output", "Output")
chain:value("prerouting", "Prerouting")
chain:value("postrouting", "Postrouting")

s:option(Value, "iface", "Eingangsschnittstelle").optional = true
s:option(Value, "oface", "Ausgangsschnittstelle").optional = true
s:option(Value, "proto", "Protokoll").optional = true
s:option(Value, "source", "Quelladresse").optional = true
s:option(Value, "destination", "Zieladresse").optional = true
s:option(Value, "sport", "Quellports").optional = true
s:option(Value, "dport", "Zielports").optional = true
s:option(Value, "to", "Neues Ziel").optional = true

state = s:option(MultiValue, "state", "Status")
state.optional  = true
state.delimiter = ","
state:value("NEW", "neu")
state:value("ESTABLISHED", "etabliert")
state:value("RELATED", "zugehörig")
state:value("INVALID", "ungültig")

s:option(Value, "jump", "Aktion", "ACCEPT, REJECT, DROP, MASQUERADE, DNAT, SNAT, ...").optional = true


add = s:option(Value, "command", "Befehl")
add.size = 50

return m