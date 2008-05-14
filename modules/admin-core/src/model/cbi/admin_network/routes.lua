-- ToDo: Translate, Add descriptions and help texts
m = Map("network", "Statische Routen", [[Statische Routen geben an,
über welche Schnittstelle und welches Gateway ein bestimmter Host
oder ein bestimmtes Netzwerk erreicht werden kann.]])

s = m:section(TypedSection, "route")
s.addremove = true
s.anonymous = true
s.template  = "cbi/tblsection"

iface = s:option(ListValue, "interface", "Schnittstelle")
for k, v in pairs(ffluci.model.uci.sections("network")) do
	if v[".type"] == "interface" and k ~= "loopback" then
		iface:value(k)
	end
end

s:option(Value, "target", "Ziel", "Host-IP oder Netzwerk")

s:option(Value, "netmask", "Netzmaske", "falls Ziel ein Netzwerk ist").rmemepty = true

s:option(Value, "gateway", "Gateway")

return m