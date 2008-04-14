-- ToDo: Translate, Add descriptions and help texts
m = Map("network", "Statische Routen", [[Statische Routen geben an,
über welche Schnittstelle und welches Gateway ein bestimmter Host
oder ein bestimmtes Netzwerk erreicht werden kann.]])

s = m:section(TypedSection, "route")
s.addremove = true
s.anonymous = true

s:option(Value, "interface", "Schnittstelle")

s:option(Value, "target", "Ziel", "Host-IP oder Netzwerk")

s:option(Value, "netmask", "Netzmaske", "falls Ziel ein Netzwerk ist").rmemepty = true

s:option(Value, "gateway", "Gateway")

return m