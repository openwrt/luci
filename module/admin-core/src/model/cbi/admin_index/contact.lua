m = Map("luci", "Kontakt", [[Diese Daten sind auf der öffentlichen Kontaktseite
sichtbar. Alle Felder sind natürlich freiwillig. Du kannst soviel oder so wenig
über dich angeben, wie du möchtest.]])

c = m:section(NamedSection, "contact")

c:option(Value, "nickname", "Pseudonym")
c:option(Value, "name", "Name")
c:option(Value, "mail", "E-Mail")
c:option(Value, "phone", "Telefon")
c:option(Value, "location", "Standort")
c:option(Value, "geo", "Koordinaten", "Bitte als Breite;Länge angeben")
c:option(Value, "note", "Notiz")

return m