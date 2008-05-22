-- ToDo: Translate
require("ffluci.config")
m = Map("luci", translate("luci", "Oberfläche"), translate("luci1", 
 "Hier können Eigenschaften und die Funktionalität der Oberfläche angepasst werden."))

c = m:section(NamedSection, "main", "core", translate("general", "Allgemein"))

l = c:option(ListValue, "lang", translate("language", "Sprache"))
for k, v in pairs(ffluci.config.languages) do
	if k:sub(1, 1) ~= "." then
		l:value(k, v)
	end
end

t = c:option(ListValue, "mediaurlbase", translate("design", "Design"))
for k, v in pairs(ffluci.config.themes) do
	if k:sub(1, 1) ~= "." then
		t:value(v, k)
	end
end

u = m:section(NamedSection, "uci_oncommit", "event", translate("ucicommit", "UCI-Befehle beim Anwenden"),
 translate("ucicommit1", [[Beim Anwenden
der Konfiguration aus der Oberflächliche heraus können automatisch die relevanten Dienste neugestart werden,
sodass Änderungen sofort nach dem Anwenden aktiv werden und der Router nicht erst neugestartet werden muss.]]))
u.dynamic = true

f = m:section(NamedSection, "flash_keep", "extern", translate("keepflash", "Zu übernehmende Dateien bei Firmwareupgrade"),
 translate("keepflash1", [[Die folgenden Dateien und Verzeichnisse werden beim Aktualisieren der Firmware
über die Oberfläche automatisch in die neue Firmware übernommen.]]))
f.dynamic = true

return m