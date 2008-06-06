-- ToDo: Translate, Add descriptions and help texts
m = Map("wireless", translate("networks", "Netze"), translate("a_w_networks1", [[Pro WLAN-Gerät können mehrere Netze bereitgestellt werden.
Es sollte beachtet werden, dass es hardware- / treiberspezifische Einschränkungen gibt.
So kann pro WLAN-Gerät in der Regel entweder 1 Ad-Hoc-Zugang ODER bis zu 3 Access-Point und 1 Client-Zugang
gleichzeitig erstellt werden.]]))

s = m:section(TypedSection, "wifi-iface", "")
s.addremove = true
s.anonymous = true

s:option(Value, "ssid", translate("a_w_netid", "Netzkennung (ESSID)")).maxlength = 32

device = s:option(ListValue, "device", translate("device", "Gerät"))
luci.model.uci.foreach("wireless", "wifi-device",
	function (section)
		device:value(section[".name"])
	end)

network = s:option(ListValue, "network", translate("network", "Netzwerk"), translate("a_w_network1", "WLAN-Netz zu Netzwerk hinzufügen"))
network:value("")
luci.model.uci.foreach("network", "interface",
	function (section)
		if section[".name"] ~= "loopback" then
			network:value(section[".name"])
		end
	end)

mode = s:option(ListValue, "mode", translate("mode", "Modus"))
mode:value("ap", "Access Point")
mode:value("adhoc", "Ad-Hoc")
mode:value("sta", "Client")
mode:value("wds", "WDS")

s:option(Value, "bssid", "BSSID").optional = true

s:option(Value, "txpower", translate("a_w_txpwr", "Sendeleistung"), "dbm").rmempty = true

s:option(Flag, "frameburst", translate("a_w_brcmburst", "Broadcom-Frameburst")).optional = true
s:option(Flag, "bursting", translate("a_w_athburst", "Atheros-Frameburst")).optional = true


encr = s:option(ListValue, "encryption", translate("encryption", "Verschlüsselung"))
encr:value("none", "keine")
encr:value("wep", "WEP")
encr:value("psk", "WPA-PSK")
encr:value("wpa", "WPA-Radius")
encr:value("psk2", "WPA2-PSK")
encr:value("wpa2", "WPA2-Radius")

key = s:option(Value, "key", translate("key", "Schlüssel"))
key:depends("encryption", "wep")
key:depends("encryption", "psk")
key:depends("encryption", "wpa")
key:depends("encryption", "psk2")
key:depends("encryption", "wpa2")
key.rmempty = true

server = s:option(Value, "server", translate("a_w_radiussrv", "Radius-Server"))
server:depends("encryption", "wpa")
server:depends("encryption", "wpa2")
server.rmempty = true

port = s:option(Value, "port", translate("a_w_radiusport", "Radius-Port"))
port:depends("encryption", "wpa")
port:depends("encryption", "wpa2")
port.rmempty = true

s:option(Flag, "isolate", translate("a_w_apisolation", "AP-Isolation"), translate("a_w_apisolation1", "Unterbindet Client-Client-Verkehr")).optional = true

s:option(Flag, "hidden", translate("a_w_hideessid", "ESSID verstecken")).optional = true



return m