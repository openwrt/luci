-- Copyright 2017 Dirk Brenken (dev@brenken.org)
-- This is free software, licensed under the Apache License, Version 2.0

local fs       = require("nixio.fs")
local uci      = require("luci.model.uci").cursor()
local http     = require("luci.http")
local trmiface = uci.get("travelmate", "global", "trm_iface") or "trm_wwan"
local val      = ""

m = SimpleForm("add", translate("Add Wireless Uplink Configuration"))
m.submit = translate("Save")
m.cancel = translate("Back to overview")
m.reset = false

function m.on_cancel()
	http.redirect(luci.dispatcher.build_url("admin/services/travelmate/stations"))
end

m.hidden = {
	device      = http.formvalue("device"),
	ssid        = http.formvalue("ssid"),
	bssid       = http.formvalue("bssid"),
	wep         = http.formvalue("wep"),
	wpa_suites  = http.formvalue("wpa_suites"),
	wpa_version = http.formvalue("wpa_version")
}

if m.hidden.ssid ~= "" then
	wssid = m:field(Value, "ssid", translate("SSID"))
	wssid.datatype = "rangelength(1,32)"
	wssid.default = m.hidden.ssid or ""
else
	wssid = m:field(Value, "ssid", translate("SSID (hidden)"))
end

bssid = m:field(Value, "bssid", translate("BSSID"))
bssid.datatype = "macaddr"
bssid.default = m.hidden.bssid or ""

if (tonumber(m.hidden.wep) or 0) == 1 then
	wkey = m:field(Value, "key", translate("WEP passphrase"),
		translate("Specify the secret encryption key here."))
	wkey.password = true
	wkey.datatype = "wepkey"
elseif (tonumber(m.hidden.wpa_version) or 0) > 0 then
	if m.hidden.wpa_suites == "PSK" or m.hidden.wpa_suites == "PSK2" then
		wkey = m:field(Value, "key", translate("WPA passphrase"),
			translate("Specify the secret encryption key here."))
		wkey.password = true
		wkey.datatype = "wpakey"
	elseif m.hidden.wpa_suites == "802.1X" then
		eaptype = m:field(ListValue, "eap_type", translate("EAP-Method"))
		eaptype:value("TLS")
		eaptype:value("TTLS")
		eaptype:value("PEAP")
		eaptype.default = "PEAP"

		authentication = m:field(ListValue, "auth", translate("Authentication"))
		authentication:value("PAP")
		authentication:value("CHAP")
		authentication:value("MSCHAP")
		authentication:value("MSCHAPV2")
		authentication.default = "MSCHAPV2"

		ident = m:field(Value, "identity", translate("Identity"))

		pass = m:field(Value, "password", translate("Password"))
		pass.datatype = "wpakey"
		pass.password = true
	end
end

function wssid.write(self, section, value)
	newsection = uci:section("wireless", "wifi-iface", nil, {
		mode     = "sta",
		network  = trmiface,
		device   = m.hidden.device,
		ssid     = wssid:formvalue(section),
		bssid    = bssid:formvalue(section),
		disabled = "1"
	})
	if wkey ~= nil then
		val = wkey:formvalue(section)
		if val == "" then
			val = "changeme"
		end
	end
	if (tonumber(m.hidden.wep) or 0) == 1 then
		uci:set("wireless", newsection, "encryption", "wep-open")
		uci:set("wireless", newsection, "key", "1")
		uci:set("wireless", newsection, "key1", val)
	elseif (tonumber(m.hidden.wpa_version) or 0) > 0 then
		if m.hidden.wpa_suites == "PSK" or m.hidden.wpa_suites == "PSK2" then
			uci:set("wireless", newsection, "encryption", "psk2")
			uci:set("wireless", newsection, "key", val)
		elseif m.hidden.wpa_suites == "802.1X" then
			uci:set("wireless", newsection, "encryption", "wpa2")
			uci:set("wireless", newsection, "eap_type", eaptype:formvalue(section))
			uci:set("wireless", newsection, "auth", authentication:formvalue(section))
			val = ident:formvalue(section)
			if val == "" then
				val = "changeme"
			end
			uci:set("wireless", newsection, "identity", val)
			val = pass:formvalue(section)
			if val == "" then
				val = "changeme"
			end
			uci:set("wireless", newsection, "password", val)
		end
	else
		uci:set("wireless", newsection, "encryption", "none")
	end
	uci:save("wireless")
	uci:commit("wireless")
	http.redirect(luci.dispatcher.build_url("admin/services/travelmate/stations"))
end

return m
