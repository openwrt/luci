-- Todo: Translate
m = Map("freifunk", translate("contact", "Kontakt"), translate("contact1", [[Diese Daten sind
auf der öffentlichen Kontaktseite sichtbar. Bitte gib an, wie man dich am besten kontaktieren kann.
Diese Informationen sollten nach der Picopeering Vereinbarung mindestens deine E-Mail-Adresse enthalten.
Damit dein Knoten durch Topographieprogramme erfasst werden kann, gib bitte deine Geokoordinaten oder
zumindest deine Straße und Hausnummer unter Standort an.]]))

c = m:section(NamedSection, "contact", "public")

c:option(Value, "nickname", translate("nickname", "Pseudonym"))
c:option(Value, "name", translate("name", "Name"))
c:option(Value, "mail", translate("mail", "E-Mail"), translate("mail1", "Bitte unbedingt angeben!"))
c:option(Value, "phone", translate("phone", "Telefon"))
c:option(Value, "location", translate("location", "Standort"))
c:option(Value, "geo", translate("coord", "Koordinaten"), translate("coord1", "Bitte als Breite;Länge (z.B: 51.5;12.9) angeben"))
c:option(Value, "note", translate("note", "Notiz"))

return m