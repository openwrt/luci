m = Map("system", "Hostname", [[Definiert den Hostnamen des Routers.
Der Hostname ist eine im Netzwerk eindeutige Kennung, die dieses Gerät identifiziert.]])

s = m:section(TypedSection, "system")
s.anonymous = true

s:option(Value, "hostname", "Hostname")

return m