--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--
require("luci.tools.webadmin")
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
luci.tools.webadmin.cbi_add_networks(network)

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
encr:value("PSK", "WPA-PSK")
encr:value("WPA", "WPA-EAP", {mode="ap"}, {mode="sta"})
encr:value("PSK2", "WPA2-PSK")
encr:value("WPA2", "WPA2-EAP", {mode="ap"}, {mode="sta"})
encr:depends("mode", "ap")
encr:depends("mode", "sta")
encr:depends("mode", "wds")

server = s:option(Value, "server", translate("a_w_radiussrv"))
server:depends({mode="ap", encryption="WPA"})
server:depends({mode="ap", encryption="WPA2"})
server.rmempty = true

port = s:option(Value, "port", translate("a_w_radiusport"))
port:depends({mode="ap", encryption="WPA"})
port:depends({mode="ap", encryption="WPA2"})
port.rmempty = true

key = s:option(Value, "key", translate("key"))
key:depends("encryption", "wep")
key:depends("encryption", "PSK")
key:depends({mode="ap", encryption="WPA"})
key:depends("encryption", "PSK2")
key:depends({mode="ap", encryption="WPA2"})
key.rmempty = true

nasid = s:option(Value, "nasid", translate("a_w_nasid"))
nasid:depends({mode="ap", encryption="WPA"})
nasid:depends({mode="ap", encryption="WPA2"})
nasid.rmempty = true

eaptype = s:option(ListValue, "eap_type", translate("a_w_eaptype"))
eaptype:value("TLS")
eaptype:value("PEAP")
eaptype:depends({mode="sta", encryption="WPA"})
eaptype:depends({mode="sta", encryption="WPA2"})

cacert = s:option(Value, "ca_cert", translate("a_w_cacert"))
cacert:depends({mode="sta", encryption="WPA"})
cacert:depends({mode="sta", encryption="WPA2"})

privkey = s:option(Value, "priv_key", translate("a_w_tlsprivkey"))
privkey:depends({mode="sta", eap_type="TLS", encryption="WPA2"})
privkey:depends({mode="sta", eap_type="TLS", encryption="WPA"})

privkeypwd = s:option(Value, "priv_key_pwd", translate("a_w_tlsprivkeypwd"))
privkeypwd:depends({mode="sta", eap_type="TLS", encryption="WPA2"})
privkeypwd:depends({mode="sta", eap_type="TLS", encryption="WPA"})


auth = s:option(Value, "auth", translate("a_w_peapauth"))
auth:depends({mode="sta", eap_type="PEAP", encryption="WPA2"})
auth:depends({mode="sta", eap_type="PEAP", encryption="WPA"})

identity = s:option(Value, "identity", translate("a_w_peapidentity"))
identity:depends({mode="sta", eap_type="PEAP", encryption="WPA2"})
identity:depends({mode="sta", eap_type="PEAP", encryption="WPA"})

password = s:option(Value, "password", translate("a_w_peappassword"))
password:depends({mode="sta", eap_type="PEAP", encryption="WPA2"})
password:depends({mode="sta", eap_type="PEAP", encryption="WPA"})




s:option(Flag, "isolate", translate("a_w_apisolation"), translate("a_w_apisolation1")).optional = true

s:option(Flag, "hidden", translate("a_w_hideessid")).optional = true



return m