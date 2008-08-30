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
arg[1] = arg[1] or ""

m = Map("wireless", translate("networks"), translate("a_w_networks1"))

s = m:section(NamedSection, arg[1], "wifi-device", translate("device") .. " " .. arg[1])
--s.addremove = true

en = s:option(Flag, "disabled", translate("enable"))
en.enabled = "0"
en.disabled = "1"

function en.cfgvalue(self, section)
	return Flag.cfgvalue(self, section) or "0"
end

s:option(DummyValue, "type", translate("type"))
local hwtype = m:get(arg[1], "type")

mode = s:option(ListValue, "mode", translate("mode"))
mode:value("", "standard")
mode:value("11b", "802.11b")
mode:value("11g", "802.11g")
mode:value("11a", "802.11a")
mode:value("11bg", "802.11b+g")

if hwtype == "atheros" then
	mode:value("11gdt", "802.11adt")
	mode:value("11adt", "802.11adt")
	mode:value("fh", "fh")
end


mode.rmempty = true

ch = s:option(Value, "channel", translate("a_w_channel"))
for i=1, 14 do
	ch:value(i, i .. " (2.4 GHz)")
end
for i=36, 64, 4 do
	ch:value(i, i .. " (5 GHz)")
end
for i=100, 140, 4 do
	ch:value(i, i .. " (5 GHz)")
end
ch:value(147, 147 .. " (5 GHz)")
ch:value(151, 151 .. " (5 GHz)")
ch:value(155, 155 .. " (5 GHz)")
ch:value(167, 167 .. " (5 GHz)")

s:option(Value, "txantenna", translate("a_w_txantenna")).optional = true

s:option(Value, "rxantenna", translate("a_w_rxantenna")).optional = true

s:option(Value, "distance", translate("distance"),
	translate("a_w_distance1")).optional = true

s:option(Value, "diversity", translate("a_w_diversity")):depends("type", "atheros")
	
country = s:option(Value, "country", translate("a_w_countrycode"))
country.optional = true
country:depends("type", "broadcom")

maxassoc = s:option(Value, "maxassoc", translate("a_w_connlimit"))
maxassoc:depends("type", "broadcom")
maxassoc.optional = true



----------------------- Interface -----------------------

s = m:section(TypedSection, "wifi-iface", translate("interfaces"))
s.addremove = true
s.anonymous = true
s:depends("device", arg[1])
s.defaults.device = arg[1]

s:option(Value, "ssid", translate("a_w_netid")).maxlength = 32

network = s:option(Value, "network", translate("network"), translate("a_w_network1"))
network.rmempty = true
network:value("")
network.combobox_manual = translate("a_w_netmanual")
luci.tools.webadmin.cbi_add_networks(network)

function network.write(self, section, value)	
	if not m.uci:get("network", value) then 
		m:chain("network")
		m.uci:set("network", value, "interface")
		Value.write(self, section, value)
	else
		if m.uci:get("network", value) == "interface" then
			Value.write(self, section, value)
		end
	end
end

mode = s:option(ListValue, "mode", translate("mode"))
mode:value("ap", translate("a_w_ap"))
mode:value("adhoc", translate("a_w_adhoc"))
mode:value("ahdemo", translate("a_w_ahdemo"))
mode:value("sta", translate("a_w_client"))
mode:value("monitor", translate("a_w_monitor"))

if hwtype ~= "atheros" then
	mode:value("wds", translate("a_w_wds"))
end

if hwtype == "atheros" then
	s:option(Flag, "wds", translate("a_w_wds"))
end

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