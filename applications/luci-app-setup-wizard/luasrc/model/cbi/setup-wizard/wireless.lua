-- Copyright 2018 Rosy Song <rosysong@rosinson.com>
-- Licensed to the public under the Apache License 2.0.

local uci = require "luci.model.uci".cursor()
local ntm = require "luci.model.network".init()
--local fromurl = luci.http.formvalue("fromurl")
local has_wan_changes = luci.http.formvalue("has_wan_changes") or "0"

m = SimpleForm("wireless", translate("Setup Wizard - WiFi"))
--m.back = translate("Back")
--m.redirect = luci.dispatcher.build_url("admin/system/setup-wizard/" .. fromurl)
m.submit = translate("Next")
m.reset = false
m.flow = { skip = true }

iface = m:field(ListValue, "iface", translate("WiFi Interface"))
uci.cursor():foreach("wireless", "wifi-device",
	function (section)
			local hwmode = uci:get("wireless", section[".name"], "hwmode")
			if hwmode == "11g" then
				iface:value(section[".name"], "WiFi - 2.4G")
			else
				iface:value(section[".name"], "WiFi - 5G")
			end
	end
)
iface.titleref = luci.dispatcher.build_url("admin", "network", "wireless")

ssid = m:field(Value, "ssid",
	translate("WiFi <abbr title=\"Extended Service Set Identifier\">ESSID</abbr>"))
ssid.default = "OpenWrt"
ssid.datatype = "maxlength(32)"

encr = m:field(ListValue, "encryption", translate("Encryption"))
encr:value("none", "No Encryption")
encr:value("psk-mixed", "Has Encryption")

key = m:field(Value, "key", translate("Key"))
key:depends("encryption", "psk-mixed")
key.password = true
key.datatype = "wpakey"

function m.handle(self, state, data)
	return true
end

function m.parse(sf)
	local state = SimpleForm.parse(sf)
	local r = luci.http.formvalue("cbid.wireless.1.iface")
	local s = luci.http.formvalue("cbid.wireless.1.ssid")
	local e = luci.http.formvalue("cbid.wireless.1.encr")
	local k = luci.http.formvalue("cbid.wireless.1.key")
	local args = nil

	if state == FORM_SKIP then
		args = string.format("?has_wan_changes=%s,has_wifi_changes=0&fromurl=wireless", has_wan_changes)
		luci.http.redirect(luci.dispatcher.build_url("admin/system/setup-wizard/complete") .. args)
	end

	if r then
		if s and #s > 0 then
			uci:set("wireless", radio, "ssid", s)
			if e and #e > 0 then uci:set("wireless", "default_" .. r, "encryption", e) end
			if k and #k > 0 then uci:set("wireless", "default_" .. r, "key", k) end
			uci:set("wireless", "default_" .. r, "disabled", 0)
			uci:set("wireless", r, "disabled", 0)
			args = string.format("?has_wan_changes=%s,has_wifi_changes=1&fromurl=wireless", has_wan_changes)
			luci.http.redirect(luci.dispatcher.build_url("admin/system/setup-wizard/complete") .. args)
		else
			args = string.format("?has_wan_changes=%s,has_wifi_changes=0&fromurl=wireless", has_wan_changes)
			luci.http.redirect(luci.dispatcher.build_url("admin/system/setup-wizard/complete") .. args)
		end
	end
end

return m
