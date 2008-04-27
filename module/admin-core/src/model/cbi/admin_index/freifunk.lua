-- Todo: Translate
m = Map("freifunk", "Freifunk", [[Informationen über die lokale Freifunkgemeinschaft.]])

c = m:section(NamedSection, "community", "public")

c:option(Value, "name", "Gemeinschaft")
c:option(Value, "homepage", "Webseite")
c:option(Value, "essid", "ESSID")
c:option(Value, "bssid", "BSSID")
c:option(Value, "realm", "Realm")
c:option(Value, "pool", "Adressbereich")

return m