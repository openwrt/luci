-- Copyright 2017 Dirk Brenken (dev@brenken.org)
-- This is free software, licensed under the Apache License, Version 2.0

local fs   = require("nixio.fs")
local uci  = require("luci.model.uci").cursor()
local http = require("luci.http")
local val  = ""

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
	wssid.datatype = "rangelength(1,32)"
	wssid.default = s.ssid
	bssid = m:field(Value, "bssid", translate("BSSID"))
	bssid.datatype = "macaddr"
	bssid.default = s.bssid
	if s.identity then
		ident = m:field(Value, "identity", translate("Identity"))
		ident.default = s.identity
	end
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
	uci:set("wireless", m.hidden.cfg, "bssid", bssid:formvalue(section))
	if s.identity then
		val = ident:formvalue(section)
		if val == "" then
			val = "changeme"
		end
		uci:set("wireless", m.hidden.cfg, "identity", val)
	end

	if s.encryption and s.encryption ~= "none" then
		val = wkey:formvalue(section)
		if val == "" then
			val = "changeme"
		end
		if s.key then
			uci:set("wireless", m.hidden.cfg, "key", val)
		elseif s.password then
			uci:set("wireless", m.hidden.cfg, "password", val)
		end
	end
	uci:save("wireless")
	uci:commit("wireless")
	m.on_cancel()
end

return m
