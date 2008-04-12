-- Todo: Translate
m = Map("luci", "Kontakt", [[Diese Daten sind auf der öffentlichen Kontaktseite
sichtbar. Bitte gib an, wie man dich am besten kontaktieren kann. Diese Informationen sollten
nach der Picopeering Vereinbarung mindestens deine E-Mail-Adresse enthalten.
Damit dein Knoten durch Topographieprogramme erfasst werden kann, gib bitte deine Geokoordinaten oder
zumindest deine Straße und Hausnummer unter Standort an.]])

c = m:section(NamedSection, "contact")

c:option(Value, "nickname", "Pseudonym")
c:option(Value, "name", "Name")
c:option(Value, "mail", "E-Mail", "Bitte unbedingt angeben!")
c:option(Value, "phone", "Telefon")
c:option(Value, "location", "Standort")
c:option(Value, "geo", "Koordinaten", "Bitte als Breite;Länge (z.B: 51.5;12.9) angeben")
c:option(Value, "note", "Notiz")

return m