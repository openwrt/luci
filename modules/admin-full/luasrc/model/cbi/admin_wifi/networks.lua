--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--
m = Map("wireless", translate("networks"), translate("a_w_networks1"))

s = m:section(TypedSection, "wifi-iface", "")
s.addremove = true
s.anonymous = true

s:option(Value, "ssid", translate("a_w_netid")).maxlength = 32

device = s:option(ListValue, "device", translate("device"))
luci.model.uci.foreach("wireless", "wifi-device",
	function (section)
		device:value(section[".name"])
	end)

network = s:option(ListValue, "network", translate("network"), translate("a_w_network1"))
network:value("")
luci.model.uci.foreach("network", "interface",
	function (section)
		if section[".name"] ~= "loopback" then
			network:value(section[".name"])
		end
	end)

mode = s:option(ListValue, "mode", translate("mode"))
mode:value("ap", translate("a_w_ap"))
mode:value("adhoc", translate("a_w_adhoc"))
mode:value("ahdemo", translate("a_w_ahdemo"))
mode:value("sta", translate("a_w_client"))
mode:value("wds", translate("a_w_wds"))
mode:value("monitor", translate("a_w_monitor"))

s:option(Value, "bssid", "BSSID").optional = true

s:option(Value, "txpower", translate("a_w_txpwr"), "dbm").rmempty = true

s:option(Flag, "frameburst", translate("a_w_brcmburst")).optional = true
s:option(Flag, "bursting", translate("a_w_athburst")).optional = true


encr = s:option(ListValue, "encryption", translate("encryption"))
encr:value("none", "keine")
encr:value("wep", "WEP")
encr:value("psk", "WPA-PSK")
encr:value("wpa", "WPA-Radius")
encr:value("psk2", "WPA2-PSK")
encr:value("wpa2", "WPA2-Radius")

key = s:option(Value, "key", translate("key"))
key:depends("encryption", "wep")
key:depends("encryption", "psk")
key:depends("encryption", "wpa")
key:depends("encryption", "psk2")
key:depends("encryption", "wpa2")
key.rmempty = true

server = s:option(Value, "server", translate("a_w_radiussrv"))
server:depends("encryption", "wpa")
server:depends("encryption", "wpa2")
server.rmempty = true

port = s:option(Value, "port", translate("a_w_radiusport"))
port:depends("encryption", "wpa")
port:depends("encryption", "wpa2")
port.rmempty = true

s:option(Flag, "isolate", translate("a_w_apisolation"), translate("a_w_apisolation1")).optional = true

s:option(Flag, "hidden", translate("a_w_hideessid")).optional = true



return m