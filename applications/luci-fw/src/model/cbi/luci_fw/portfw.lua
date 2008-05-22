-- ToDo: Translate, Add descriptions and help texts
require("ffluci.sys")
m = Map("luci_fw", "Portweiterleitung", [[Portweiterleitungen ermöglichen es interne
Netzwerkdienste von einem anderen externen Netzwerk aus erreichbar zu machen.]])

s = m:section(TypedSection, "portfw")
s.template  = "cbi/tblsection"
s.addremove = true
s.anonymous = true

iface = s:option(ListValue, "iface", "Schnittstelle", "Externe Schnittstelle")
iface.default = "wan"
for k, v in pairs(ffluci.model.uci.sections("network")) do
	if v[".type"] == "interface" and k ~= "loopback" then
		iface:value(k)
	end
end

proto = s:option(ListValue, "proto", "Protokoll")
proto:value("tcp", "TCP")
proto:value("udp", "UDP")
proto:value("tcpudp", "TCP + UDP")

dport = s:option(Value, "dport", "Externer Port", "Port[:Endport]")

to = s:option(Value, "to", "Interne Adresse", "IP-Adresse[:Zielport[-Zielendport]]")

return m
