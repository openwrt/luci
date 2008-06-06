m = Map("system", translate("hostname", "Hostname"), translate("a_s_hostname1", [[Definiert den Hostnamen des Routers.
Der Hostname ist eine im Netzwerk eindeutige Kennung, die dieses Gerät identifiziert.]]))

s = m:section(TypedSection, "system", "")
s.anonymous = true

s:option(Value, "hostname", translate("hostname", "Hostname"))

return m