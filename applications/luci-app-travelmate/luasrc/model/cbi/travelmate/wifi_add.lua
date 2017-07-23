-- Copyright 2017 Dirk Brenken (dev@brenken.org)
-- This is free software, licensed under the Apache License, Version 2.0

local fs = require("nixio.fs")
local uci = require("luci.model.uci").cursor()
local http = require("luci.http")
local trmiface = uci.get("travelmate", "global", "trm_iface") or "trm_wwan"

m = SimpleForm("add", translate("Add Wireless Uplink Configuration"))
m.cancel = translate("Back to overview")
m.reset = false

function m.on_cancel()
	http.redirect(luci.dispatcher.build_url("admin/services/travelmate/stations"))
end

m.hidden = {
	device      = http.formvalue("device"),
	ssid        = http.formvalue("ssid"),
	wep         = http.formvalue("wep"),
	wpa_suites	= http.formvalue("wpa_suites"),
	wpa_version = http.formvalue("wpa_version")
}

wssid = m:field(Value, "ssid", translate("SSID"))
wssid.default = m.hidden.ssid

if (tonumber(m.hidden.wep) or 0) == 1 then
	wkey = m:field(Value, "key", translate("WEP passphrase"),
		translate("Specify the secret encryption key here."))
	wkey.password = true
	wkey.datatype = "wepkey"
elseif (tonumber(m.hidden.wpa_version) or 0) > 0 and
	(m.hidden.wpa_suites == "PSK" or m.hidden.wpa_suites == "PSK2")
then
	wkey = m:field(Value, "key", translate("WPA passphrase"),
		translate("Specify the secret encryption key here."))
	wkey.password = true
	wkey.datatype = "wpakey"
end

function wssid.write(self, section, value)
	newsection = uci:section("wireless", "wifi-iface", nil, {
		mode       = "sta",
		network    = trmiface,
		device     = m.hidden.device,
		ssid       = wssid:formvalue(section),
		disabled   = "1"
	})
	if (tonumber(m.hidden.wep) or 0) == 1 then
		uci:set("wireless", newsection, "encryption", "wep-open")
		uci:set("wireless", newsection, "key", "1")
		uci:set("wireless", newsection, "key1", wkey:formvalue(section))
	elseif (tonumber(m.hidden.wpa_version) or 0) > 0 then
		uci:set("wireless", newsection, "encryption", "psk2")
		uci:set("wireless", newsection, "key", wkey:formvalue(section))
	else
		uci:set("wireless", newsection, "encryption", "none")
	end
	uci:save("wireless")
	uci:commit("wireless")
	http.redirect(luci.dispatcher.build_url("admin/services/travelmate/stations"))
end

return m
