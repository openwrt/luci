-- ToDo: Translate, Add descriptions and help texts
m = Map("wireless", translate("devices", "Geräte"), translate("a_w_devices1", 
	"An dieser Stelle können eingebaute WLAN-Geräte konfiguriert werden."))

s = m:section(TypedSection, "wifi-device", "")
--s.addremove = true

en = s:option(Flag, "disabled", translate("enable", "Aktivieren"))
en.enabled = "0"
en.disabled = "1"

t = s:option(ListValue, "type", translate("type", "Typ"))
t:value("broadcom")
t:value("atheros")
t:value("mac80211")
t:value("prism2")
--[[
require("luci.sys")
local c = ". /etc/functions.sh;for i in /lib/wifi/*;do . $i;done;echo $DRIVERS"
for driver in luci.sys.execl(c)[1]:gmatch("[^ ]+") do
	t:value(driver)
end
]]--

mode = s:option(ListValue, "mode", translate("mode", "Modus"))
mode:value("", "standard")
mode:value("11b", "802.11b")
mode:value("11g", "802.11g")
mode:value("11a", "802.11a")
mode:value("11bg", "802.11b+g")
mode.rmempty = true

s:option(Value, "channel", translate("a_w_channel", "Funkkanal"))

s:option(Value, "txantenna", translate("a_w_txantenna", "Sendeantenne")).rmempty = true

s:option(Value, "rxantenna", translate("a_w_rxantenna", "Empfangsantenne")).rmempty = true

s:option(Value, "distance", translate("distance", "Distanz"),
	translate("a_w_distance1", "Distanz zum am weitesten entfernten Funkpartner (m)")).rmempty = true

s:option(Value, "diversity", translate("a_w_diversity", "Diversität")):depends("type", "atheros")
	
country = s:option(Value, "country", translate("a_w_countrycode", "Ländercode"))
country.optional = true
country:depends("type", "broadcom")

maxassoc = s:option(Value, "maxassoc", translate("a_w_connlimit", "Verbindungslimit"))
maxassoc:depends("type", "broadcom")
maxassoc.optional = true

return m