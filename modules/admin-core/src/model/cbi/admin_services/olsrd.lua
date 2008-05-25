-- ToDo: Autodetect things, Translate, Add descriptions
require("luci.fs")

m = Map("olsr", "OLSR", [[OLSR ist ein flexibles Routingprotokoll, 
dass den Aufbau von mobilen Ad-Hoc Netzen unterstützt.]])

s = m:section(NamedSection, "general", "olsr", "Allgemeine Einstellungen")

debug = s:option(ListValue, "DebugLevel", "Debugmodus")
for i=0, 9 do
	debug:value(i)
end

ipv = s:option(ListValue, "IpVersion", "Internet Protokoll")
ipv:value("4", "IPv4")
ipv:value("6", "IPv6")

noint = s:option(Flag, "AllowNoInt", "Start ohne Netzwerk")
noint.enabled = "yes"
noint.disabled = "no"

s:option(Value, "Pollrate", "Abfragerate (Pollrate)", "s")

tcr = s:option(ListValue, "TcRedundancy", "TC-Redundanz")
tcr:value("0", "MPR-Selektoren")
tcr:value("1", "MPR-Selektoren und MPR")
tcr:value("2", "Alle Nachbarn")

s:option(Value, "MprCoverage", "MPR-Erfassung")

lql = s:option(ListValue, "LinkQualityLevel", "VQ-Level")
lql:value("0", "deaktiviert")
lql:value("1", "MPR-Auswahl")
lql:value("2", "MPR-Auswahl und Routing")

lqfish = s:option(Flag, "LinkQualityFishEye", "VQ-Fisheye")

s:option(Value, "LinkQualityWinSize", "VQ-Fenstergröße")

s:option(Value, "LinkQualityDijkstraLimit", "VQ-Dijkstralimit")

hyst = s:option(Flag, "UseHysteresis", "Hysterese aktivieren")
hyst.enabled = "yes"
hyst.disabled = "no"


i = m:section(TypedSection, "Interface", "Schnittstellen")
i.anonymous = true
i.addremove = true
i.dynamic = true

network = i:option(ListValue, "Interface", "Netzwerkschnittstellen")
network:value("")
for k, v in pairs(luci.model.uci.sections("network")) do
	if v[".type"] == "interface" and k ~= "loopback" then
		network:value(k)
	end
end

i:option(Value, "HelloInterval", "Hello-Intervall")

i:option(Value, "HelloValidityTime", "Hello-Gültigkeit")

i:option(Value, "TcInterval", "TC-Intervall")

i:option(Value, "TcValidityTime", "TC-Gültigkeit")

i:option(Value, "MidInterval", "MID-Intervall")

i:option(Value, "MidValidityTime", "MID-Gültigkeit")

i:option(Value, "HnaInterval", "HNA-Intervall")

i:option(Value, "HnaValidityTime", "HNA-Gültigkeit")


p = m:section(TypedSection, "LoadPlugin", "Plugins")
p.addremove = true
p.dynamic = true

lib = p:option(ListValue, "Library", "Bibliothek")
lib:value("")
for k, v in pairs(luci.fs.dir("/usr/lib")) do
	if v:sub(1, 6) == "olsrd_" then
		lib:value(v)
	end
end

return m