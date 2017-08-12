-- Copyright 2017 Dirk Brenken (dev@brenken.org)
-- This is free software, licensed under the Apache License, Version 2.0

local fs = require("nixio.fs")
local uci = require("luci.model.uci").cursor()
local http = require("luci.http")

m = SimpleForm("edit", translate("Edit Wireless Uplink Configuration"))
m.submit = translate("Save")
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
	wssid.datatype = "rangelength(1,32)"
	if s.encryption and s.key then
		wkey = m:field(Value, "key", translatef("Passphrase (%s)", s.encryption))
	elseif s.encryption and s.password then
		wkey = m:field(Value, "password", translatef("Passphrase (%s)", s.encryption))
	end
	if s.encryption and (s.key or s.password) then
		wkey.password = true
		wkey.default = s.key or s.password
		if s.encryption == "wep" then
			wkey.datatype = "wepkey"
		else
			wkey.datatype = "wpakey"
		end
	end
else
	m.on_cancel()
end

function wssid.write(self, section, value)
	uci:set("wireless", m.hidden.cfg, "ssid", wssid:formvalue(section))
	if s.encryption and s.key then
		uci:set("wireless", m.hidden.cfg, "key", wkey:formvalue(section))
	elseif s.encryption and s.password then
		uci:set("wireless", m.hidden.cfg, "password", wkey:formvalue(section))
	end
	uci:save("wireless")
	uci:commit("wireless")
	m.on_cancel()
end

return m
