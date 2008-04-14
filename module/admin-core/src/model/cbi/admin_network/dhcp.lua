-- ToDo: Translate, Add descriptions and help texts
require("ffluci.model.uci")
require("ffluci.sys")

m = Map("dhcp", "DHCP", [[Mit Hilfe von DHCP können Netzteilnehmer automatisch
ihre Netzwerkkonfiguration (IP-Adresse, Netzmaske, DNS-Server, DHCP, ...) beziehen.]])

s = m:section(TypedSection, "dhcp")
s.addremove = true
s.anonymous = true

iface = s:option(ListValue, "interface", "Schnittstelle")
for k, v in pairs(ffluci.model.uci.show("network").network) do
	if v[".type"] == "interface" and k ~= "loopback" then
		iface:value(k)
	end
end

s:option(Value, "start", "Start", "Erste vergebene Adresse (letztes Oktett)").rmempty = true

s:option(Value, "limit", "Limit", "Letzte vergebene Adresse (letztes Oktett)").rmempty = true

s:option(Flag, "dynamicdhcp", "Dynamisches DHCP").rmempty = true

s:option(Value, "name", "Name").optional = true

s:option(Flag, "ignore", "Schnittstelle ignorieren", "DHCP für dieses Netzwerk deaktivieren").optional = true

s:option(Value, "netmask", "Netzmaske").optional = true

s:option(Flag, "force", "Start erzwingen").optional = true

for i, line in pairs(ffluci.sys.execl("dnsmasq --help dhcp")) do
	k, v = line:match("([^ ]+) +([^ ]+)")
	s:option(Value, "dhcp"..k, v).optional = true
end
	
return m