--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>
Copyright 2008 Jo-Philipp Wich <xm@leipzig.freifunk.net>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--
m = Map("wireless", translate("wifi"), translate("a_w_devices1"))
m:chain("network")

s = m:section(TypedSection, "wifi-device", translate("devices"))

en = s:option(Flag, "disabled", translate("enable"))
en.enabled = "0"
en.disabled = "1"

mode = s:option(ListValue, "mode", translate("mode"))
mode:value("", "standard")
mode:value("11b", "802.11b")
mode:value("11g", "802.11g")
mode:value("11a", "802.11a")
mode:value("11bg", "802.11b+g")
mode.rmempty = true

s:option(Value, "channel", translate("a_w_channel"))



s = m:section(TypedSection, "wifi-iface", translate("m_n_local"))
s.anonymous = true

s:option(Value, "ssid", translate("a_w_netid")).maxlength = 32

local devs = {}
luci.model.uci.foreach("wireless", "wifi-device",
	function (section)
		table.insert(devs, section[".name"])
	end)
	
if #devs > 1 then
	device = s:option(DummyValue, "device", translate("device"))
else
	s.defaults.device = devs[1]
end

mode = s:option(ListValue, "mode", translate("mode"))
mode:value("ap", translate("m_w_ap"))
mode:value("adhoc", translate("m_w_adhoc"))
mode:value("sta", translate("m_w_client"))

function mode.write(self, section, value)
	if value == "sta" then
		-- ToDo: Move this away
		if not luci.model.uci.get("network", "wan") then
			luci.model.uci.set("network", "wan", "proto", "none")
			luci.model.uci.set("network", "wan", "ifname", " ")
		end

		local oldif = luci.model.uci.get("network", "wan", "ifname")
		if oldif and oldif ~= " " then
			luci.model.uci.set("network", "wan", "_ifname", oldif)
		end
		luci.model.uci.set("network", "wan", "ifname", " ")

		self.map:set(section, "network", "wan")
	else
		if luci.model.uci.get("network", "wan", "_ifname") then
			luci.model.uci.set("network", "wan", "ifname", luci.model.uci.get("network", "wan", "_ifname"))
		end
		self.map:set(section, "network", "lan")
	end

	return ListValue.write(self, section, value)
end

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

iso = s:option(Flag, "isolate", translate("a_w_apisolation"), translate("a_w_apisolation1"))
iso.rmempty = true
iso:depends("mode", "ap")

hide = s:option(Flag, "hidden", translate("a_w_hideessid"))
hide.rmempty = true
hide:depends("mode", "ap")

return m