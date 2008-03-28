-- ToDo: Translate, Add descriptions and help texts
m = Map("wireless", "Netze")

s = m:section(TypedSection, "wifi-iface")
s.addremove = true
s.anonymous = true

s:option(Value, "ssid", "Netzkennung (ESSID)").maxlength = 32

device = s:option(ListValue, "device", "Gerät")
for k, v in pairs(ffluci.model.uci.show("wireless").wireless) do
	if v[".type"] == "wifi-device" then
		device:value(k)
	end
end

network = s:option(ListValue, "network", "Netzwerk")
network:value("")
for k, v in pairs(ffluci.model.uci.show("network").network) do
	if v[".type"] == "interface" then
		network:value(k)
	end
end

mode = s:option(ListValue, "mode", "Modus")
mode:value("ap", "Access Point")
mode:value("adhoc", "Ad-Hoc")
mode:value("sta", "Client")
mode:value("wds", "WDS")

s:option(Value, "bssid", "BSSID").optional = true

s:option(Value, "txpower", "Sendeleistung", "dbm").rmempty = true

encr = s:option(ListValue, "encryption", "Verschlüsselung")
encr:value("none", "keine")
encr:value("wep", "WEP")
encr:value("psk", "WPA-PSK")
encr:value("wpa", "WPA-Radius")
encr:value("psk2", "WPA2-PSK")
encr:value("wpa2", "WPA2-Radius")

key = s:option(Value, "key", "Schlüssel")
key:depends("encryption", "wep")
key:depends("encryption", "psk")
key:depends("encryption", "wpa")
key:depends("encryption", "psk2")
key:depends("encryption", "wpa2")
key.rmempty = true

server = s:option(Value, "server", "Radius-Server")
server:depends("encryption", "wpa")
server:depends("encryption", "wpa2")
server.rmempty = true

port = s:option(Value, "port", "Radius-Port")
port:depends("encryption", "wpa")
port:depends("encryption", "wpa2")
port.rmempty = true

s:option(Flag, "isolate", "AP-Isolation", "Unterbindet Client-Client-Verkehr").optional = true

s:option(Flag, "hidden", "ESSID verstecken").optional = true



return m