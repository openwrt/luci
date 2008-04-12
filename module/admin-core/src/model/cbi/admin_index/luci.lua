-- ToDo: Translate
require("ffluci.config")
m = Map("luci", "Oberfläche", "Hier können Eigenschaften und die Funktionalität der Oberfläche angepasst werden.")

c = m:section(NamedSection, "main", "core", "Allgemein")

l = c:option(ListValue, "lang", "Sprache")
for k, v in pairs(ffluci.config.languages) do
	if k:sub(1, 1) ~= "." then
		l:value(k, v)
	end
end

t = c:option(ListValue, "mediaurlbase", "Design")
for k, v in pairs(ffluci.config.themes) do
	if k:sub(1, 1) ~= "." then
		t:value(v, k)
	end
end

p = m:section(NamedSection, "category_privileges", "core", "Kategorieprivilegien", [[Zur
zusätzlichen Sicherung der Oberfläche gegen Angreifer, können hier die Ausführungsrechte
der Seiten für einzelne Kategorien reduziert werden. So können z.B. Sicherheitslücken im
ungeschützten Bereich der Oberfläche nicht mehr zur Übernahme des Routers genutzt werden.]])
p.dynamic = true

u = m:section(NamedSection, "uci_oncommit", "event", "UCI-Befehle beim Anwenden", [[Beim Anwenden
der Konfiguration aus der Oberflächliche heraus können automatisch die relevanten Dienste neugestart werden,
sodass Änderungen sofort nach dem Anwenden aktiv werden und der Router nicht erst neugestartet werden muss-]])
u.dynamic = true

f = m:section(NamedSection, "flash_keep", "extern", "Zu übernehmende Dateien bei Firmwareupgrade", [[Die folgenden
Dateien und Verzeichnisse werden beim Aktualisieren der Firmware über die Oberfläche automatisch in die neue Firmware
übernommen.]])
f.dynamic = true

return m