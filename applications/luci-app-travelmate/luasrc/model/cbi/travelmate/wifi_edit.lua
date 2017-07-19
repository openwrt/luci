-- Copyright 2017 Dirk Brenken (dev@brenken.org)
-- This is free software, licensed under the Apache License, Version 2.0

local fs = require("nixio.fs")
local uci = require("luci.model.uci").cursor()
local http = require("luci.http")

m = SimpleForm("edit", translate("Edit Wireless Uplink Configuration"))
m.cancel = translate("Back to overview")
m.reset = false

function m.on_cancel()
	http.redirect(luci.dispatcher.build_url("admin/services/travelmate/stations"))
end

m.hidden = {
	cfg = http.formvalue("cfg")
}

local s = uci:get_all("wireless", m.hidden.cfg)
if s ~= nil then
	wssid = m:field(Value, "ssid", translate("SSID"))
	wssid.default = s.ssid
	
	if s.encryption and s.key then
		wkey = m:field(Value, "key", translatef("Passphrase (%s)", s.encryption))
		wkey.password = true
		wkey.default = s.key
		if s.encryption == "wep" then
			wkey.datatype = "wepkey"
		else
			wkey.datatype = "wpakey"
		end
	end
else
	http.redirect(luci.dispatcher.build_url("admin/services/travelmate/stations"))
end

function wssid.write(self, section, value)
	uci:set("wireless", m.hidden.cfg, "ssid", wssid:formvalue(section))
	if s.encryption and s.key then
		uci:set("wireless", m.hidden.cfg, "key", wkey:formvalue(section))
	end
	uci:save("wireless")
	uci:commit("wireless")
	http.redirect(luci.dispatcher.build_url("admin/services/travelmate/stations"))
end

return m
