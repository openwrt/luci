-- ToDo: Autodetect things, Translate, Add descriptions
require("ffluci.fs")

m = Map("olsr", "OLSR")

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

s:option(Value, "Pollrate", "Abfragerate (Pollrate)", "s").isnumber = true

tcr = s:option(ListValue, "TcRedundancy", "TC-Redundanz")
tcr:value("0", "MPR-Selektoren")
tcr:value("1", "MPR-Selektoren und MPR")
tcr:value("2", "Alle Nachbarn")

s:option(Value, "MprCoverage", "MPR-Erfassung").isinteger = true

lql = s:option(ListValue, "LinkQualityLevel", "VQ-Level")
lql:value("0", "deaktiviert")
lql:value("1", "MPR-Auswahl")
lql:value("2", "MPR-Auswahl und Routing")

lqfish = s:option(Flag, "LinkQualityFishEye", "VQ-Fisheye")

s:option(Value, "LinkQualityWinSize", "VQ-Fenstergröße").isinteger = true

s:option(Value, "LinkQualityDijkstraLimit", "VQ-Dijkstralimit")

hyst = s:option(Flag, "UseHysteresis", "Hysterese aktivieren")
hyst.enabled = "yes"
hyst.disabled = "no"


i = m:section(TypedSection, "Interface", "Schnittstellen")
i.anonymous = true
i.addremove = true
i.dynamic = true

i:option(Value, "Interface", "Netzwerkschnittstellen")

i:option(Value, "HelloInterval", "Hello-Intervall").isnumber = true

i:option(Value, "HelloValidityTime", "Hello-Gültigkeit").isnumber = true

i:option(Value, "TcInterval", "TC-Intervall").isnumber = true

i:option(Value, "TcValidityTime", "TC-Gültigkeit").isnumber = true

i:option(Value, "MidInterval", "MID-Intervall").isnumber = true

i:option(Value, "MidValidityTime", "MID-Gültigkeit").isnumber = true

i:option(Value, "HnaInterval", "HNA-Intervall").isnumber = true

i:option(Value, "HnaValidityTime", "HNA-Gültigkeit").isnumber = true


p = m:section(TypedSection, "LoadPlugin", "Plugins")
p.addremove = true
p.dynamic = true

lib = p:option(ListValue, "Library", "Bibliothek")
lib:value("")
for k, v in pairs(ffluci.fs.dir("/usr/lib")) do
	if v:sub(1, 6) == "olsrd_" then
		lib:value(v)
	end
end

return m