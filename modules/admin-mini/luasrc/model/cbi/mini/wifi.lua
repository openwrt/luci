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

-- Data init --

local fs  = require "nixio.fs"
local sys = require "luci.sys"
local uci = require "luci.model.uci".cursor()

if not uci:get("network", "wan") then
	uci:section("network", "interface", "wan", {proto="none", ifname=" "})
	uci:save("network")
	uci:commit("network")
end

local wlcursor = luci.model.uci.cursor_state()
local wireless = wlcursor:get_all("wireless")
local wifidata = sys.wifi.getiwconfig()
local wifidevs = {}
local ifaces = {}

for k, v in pairs(wireless) do
	if v[".type"] == "wifi-iface" then
		table.insert(ifaces, v)
	end
end

wlcursor:foreach("wireless", "wifi-device",
	function(section)
		table.insert(wifidevs, section[".name"])
	end)


-- Main Map --

m = Map("wireless", translate("wifi"), translate("a_w_devices1"))
m:chain("network")


-- Status Table --
s = m:section(Table, ifaces, translate("networks"))

link = s:option(DummyValue, "_link", translate("link"))
function link.cfgvalue(self, section)
	local ifname = self.map:get(section, "ifname")
	return wifidata[ifname] and wifidata[ifname]["Link Quality"] or "-"
end

essid = s:option(DummyValue, "ssid", "ESSID")

bssid = s:option(DummyValue, "_bsiid", "BSSID")
function bssid.cfgvalue(self, section)
	local ifname = self.map:get(section, "ifname")
	return (wifidata[ifname] and (wifidata[ifname].Cell
	 or wifidata[ifname]["Access Point"])) or "-"
end

channel = s:option(DummyValue, "channel", translate("channel"))
function channel.cfgvalue(self, section)
	return wireless[self.map:get(section, "device")].channel
end

protocol = s:option(DummyValue, "_mode", translate("protocol"))
function protocol.cfgvalue(self, section)
	local mode = wireless[self.map:get(section, "device")].mode
	return mode and "802." .. mode
end

mode = s:option(DummyValue, "mode", translate("mode"))
encryption = s:option(DummyValue, "encryption", translate("iwscan_encr"))

power = s:option(DummyValue, "_power", translate("power"))
function power.cfgvalue(self, section)
	local ifname = self.map:get(section, "ifname")
	return wifidata[ifname] and wifidata[ifname]["Tx-Power"] or "-"
end

scan = s:option(Button, "_scan", translate("scan"))
scan.inputstyle = "find"

function scan.cfgvalue(self, section)
	return self.map:get(section, "ifname") or false
end

-- WLAN-Scan-Table --

t2 = m:section(Table, {}, translate("iwscan"), translate("iwscan1"))

function scan.write(self, section)
	m.autoapply = false
	t2.render = t2._render
	local ifname = self.map:get(section, "ifname")
	luci.util.update(t2.data, sys.wifi.iwscan(ifname))
end

t2._render = t2.render
t2.render = function() end

t2:option(DummyValue, "Quality", translate("iwscan_link"))
essid = t2:option(DummyValue, "ESSID", "ESSID")
function essid.cfgvalue(self, section)
	return self.map:get(section, "ESSID")
end

t2:option(DummyValue, "Address", "BSSID")
t2:option(DummyValue, "Mode", translate("mode"))
chan = t2:option(DummyValue, "channel", translate("channel"))
function chan.cfgvalue(self, section)
	return self.map:get(section, "Channel")
	    or self.map:get(section, "Frequency")
	    or "-"
end

t2:option(DummyValue, "Encryption key", translate("iwscan_encr"))

t2:option(DummyValue, "Signal level", translate("iwscan_signal"))

t2:option(DummyValue, "Noise level", translate("iwscan_noise"))



if #wifidevs < 1 then
	return m
end

-- Config Section --

s = m:section(NamedSection, wifidevs[1], "wifi-device", translate("devices"))
s.addremove = false

en = s:option(Flag, "disabled", translate("enable"))
en.rmempty = false
en.enabled = "0"
en.disabled = "1"

function en.cfgvalue(self, section)
	return Flag.cfgvalue(self, section) or "0"
end


local hwtype = m:get(wifidevs[1], "type")

if hwtype == "atheros" then
	mode = s:option(ListValue, "hwmode", translate("mode"))
	mode.override_values = true
	mode:value("", "auto")
	mode:value("11b", "802.11b")
	mode:value("11g", "802.11g")
	mode:value("11a", "802.11a")
	mode:value("11bg", "802.11b+g")
	mode.rmempty = true
end


ch = s:option(Value, "channel", translate("a_w_channel"))
for i=1, 14 do
	ch:value(i, i .. " (2.4 GHz)")
end


s = m:section(TypedSection, "wifi-iface", translate("m_n_local"))
s.anonymous = true
s.addremove = false

s:option(Value, "ssid", translate("a_w_netid"))

bssid = s:option(Value, "bssid", translate("wifi_bssid"))

local devs = {}
luci.model.uci.cursor():foreach("wireless", "wifi-device",
	function (section)
		table.insert(devs, section[".name"])
	end)

if #devs > 1 then
	device = s:option(DummyValue, "device", translate("device"))
else
	s.defaults.device = devs[1]
end

mode = s:option(ListValue, "mode", translate("mode"))
mode.override_values = true
mode:value("ap", translate("m_w_ap"))
mode:value("adhoc", translate("m_w_adhoc"))
mode:value("sta", translate("m_w_client"))

function mode.write(self, section, value)
	if value == "sta" then
		local oldif = m.uci:get("network", "wan", "ifname")
		if oldif and oldif ~= " " then
			m.uci:set("network", "wan", "_ifname", oldif)
		end
		m.uci:set("network", "wan", "ifname", " ")

		self.map:set(section, "network", "wan")
	else
		if m.uci:get("network", "wan", "_ifname") then
			m.uci:set("network", "wan", "ifname", m.uci:get("network", "wan", "_ifname"))
		end
		self.map:set(section, "network", "lan")
	end

	return ListValue.write(self, section, value)
end

encr = s:option(ListValue, "encryption", translate("encryption"))
encr.override_values = true
encr:value("none", "No Encryption")
encr:value("wep", "WEP")

if hwtype == "atheros" or hwtype == "mac80211" then
	local supplicant = fs.access("/usr/sbin/wpa_supplicant")
	local hostapd    = fs.access("/usr/sbin/hostapd")

	if hostapd and supplicant then
		encr:value("psk", "WPA-PSK")
		encr:value("psk2", "WPA2-PSK")
		encr:value("psk-mixed", "WPA-PSK/WPA2-PSK Mixed Mode")
		encr:value("wpa", "WPA-Radius", {mode="ap"}, {mode="sta"})
		encr:value("wpa2", "WPA2-Radius", {mode="ap"}, {mode="sta"})
	elseif hostapd and not supplicant then
		encr:value("psk", "WPA-PSK", {mode="ap"}, {mode="adhoc"})
		encr:value("psk2", "WPA2-PSK", {mode="ap"}, {mode="adhoc"})
		encr:value("psk-mixed", "WPA-PSK/WPA2-PSK Mixed Mode", {mode="ap"}, {mode="adhoc"})
		encr:value("wpa", "WPA-Radius", {mode="ap"})
		encr:value("wpa2", "WPA2-Radius", {mode="ap"})
		encr.description = translate("wifi_wpareq")
	elseif not hostapd and supplicant then
		encr:value("psk", "WPA-PSK", {mode="sta"})
		encr:value("psk2", "WPA2-PSK", {mode="sta"})
		encr:value("psk-mixed", "WPA-PSK/WPA2-PSK Mixed Mode", {mode="sta"})
		encr:value("wpa", "WPA-EAP", {mode="sta"})
		encr:value("wpa2", "WPA2-EAP", {mode="sta"})
		encr.description = translate("wifi_wpareq")
	else
		encr.description = translate("wifi_wpareq")
	end
elseif hwtype == "broadcom" then
	encr:value("psk", "WPA-PSK")
	encr:value("psk2", "WPA2-PSK")
	encr:value("psk+psk2", "WPA-PSK/WPA2-PSK Mixed Mode")
end

key = s:option(Value, "key", translate("key"))
key:depends("encryption", "wep")
key:depends("encryption", "psk")
key:depends("encryption", "psk2")
key:depends("encryption", "psk+psk2")
key:depends("encryption", "psk-mixed")
key:depends({mode="ap", encryption="wpa"})
key:depends({mode="ap", encryption="wpa2"})
key.rmempty = true
key.password = true

server = s:option(Value, "server", translate("a_w_radiussrv"))
server:depends({mode="ap", encryption="wpa"})
server:depends({mode="ap", encryption="wpa2"})
server.rmempty = true

port = s:option(Value, "port", translate("a_w_radiusport"))
port:depends({mode="ap", encryption="wpa"})
port:depends({mode="ap", encryption="wpa2"})
port.rmempty = true


if hwtype == "atheros" or hwtype == "mac80211" then
	nasid = s:option(Value, "nasid", translate("a_w_nasid"))
	nasid:depends({mode="ap", encryption="wpa"})
	nasid:depends({mode="ap", encryption="wpa2"})
	nasid.rmempty = true

	eaptype = s:option(ListValue, "eap_type", translate("a_w_eaptype"))
	eaptype:value("TLS")
	eaptype:value("TTLS")
	eaptype:value("PEAP")
	eaptype:depends({mode="sta", encryption="wpa"})
	eaptype:depends({mode="sta", encryption="wpa2"})

	cacert = s:option(FileUpload, "ca_cert", translate("a_w_cacert"))
	cacert:depends({mode="sta", encryption="wpa"})
	cacert:depends({mode="sta", encryption="wpa2"})

	privkey = s:option(FileUpload, "priv_key", translate("a_w_tlsprivkey"))
	privkey:depends({mode="sta", eap_type="TLS", encryption="wpa2"})
	privkey:depends({mode="sta", eap_type="TLS", encryption="wpa"})

	privkeypwd = s:option(Value, "priv_key_pwd", translate("a_w_tlsprivkeypwd"))
	privkeypwd:depends({mode="sta", eap_type="TLS", encryption="wpa2"})
	privkeypwd:depends({mode="sta", eap_type="TLS", encryption="wpa"})


	auth = s:option(Value, "auth", translate("a_w_peapauth"))
	auth:value("PAP")
	auth:value("CHAP")
	auth:value("MSCHAP")
	auth:value("MSCHAPV2")
	auth:depends({mode="sta", eap_type="PEAP", encryption="wpa2"})
	auth:depends({mode="sta", eap_type="PEAP", encryption="wpa"})
	auth:depends({mode="sta", eap_type="TTLS", encryption="wpa2"})
	auth:depends({mode="sta", eap_type="TTLS", encryption="wpa"})


	identity = s:option(Value, "identity", translate("a_w_peapidentity"))
	identity:depends({mode="sta", eap_type="PEAP", encryption="wpa2"})
	identity:depends({mode="sta", eap_type="PEAP", encryption="wpa"})
	identity:depends({mode="sta", eap_type="TTLS", encryption="wpa2"})
	identity:depends({mode="sta", eap_type="TTLS", encryption="wpa"})

	password = s:option(Value, "password", translate("a_w_peappassword"))
	password:depends({mode="sta", eap_type="PEAP", encryption="wpa2"})
	password:depends({mode="sta", eap_type="PEAP", encryption="wpa"})
	password:depends({mode="sta", eap_type="TTLS", encryption="wpa2"})
	password:depends({mode="sta", eap_type="TTLS", encryption="wpa"})
end


if hwtype == "atheros" or hwtype == "broadcom" then
	iso = s:option(Flag, "isolate", translate("a_w_apisolation"), translate("a_w_apisolation1"))
	iso.rmempty = true
	iso:depends("mode", "ap")

	hide = s:option(Flag, "hidden", translate("a_w_hideessid"))
	hide.rmempty = true
	hide:depends("mode", "ap")
end

if hwtype == "mac80211" or hwtype == "atheros" then
	bssid:depends({mode="adhoc"})
end

if hwtype == "broadcom" then
	bssid:depends({mode="wds"})
	bssid:depends({mode="adhoc"})
end


return m
