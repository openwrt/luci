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
s.addremove = false

back = s:option(DummyValue, "_overview", translate("overview"))
back.value = ""
back.titleref = luci.dispatcher.build_url("admin", "network", "wireless")


en = s:option(Flag, "disabled", translate("enable"))
en.enabled = "0"
en.disabled = "1"
en.rmempty = false

function en.cfgvalue(self, section)
	return Flag.cfgvalue(self, section) or "0"
end

s:option(DummyValue, "type", translate("type"))
local hwtype = m:get(arg[1], "type")
-- NanoFoo
local nsantenna = m:get(arg[1], "antenna")

ch = s:option(Value, "channel", translate("a_w_channel"))
ch:value("auto", translate("wifi_auto"))
for c, f in luci.util.kspairs(luci.sys.wifi.channels()) do
	ch:value(c, "%i (%.3f GHz)" %{ c, f })
end


------------------- MAC80211 Device ------------------

if hwtype == "mac80211" then
	s:option(Value, "txpower", translate("a_w_txpwr"), "dBm").rmempty = true
end


------------------- Madwifi Device ------------------

if hwtype == "atheros" then
	s:option(Value, "txpower", translate("a_w_txpwr"), "dBm").rmempty = true

	mode = s:option(ListValue, "hwmode", translate("mode"))
	mode:value("", translate("wifi_auto"))
	mode:value("11b", "802.11b")
	mode:value("11g", "802.11g")
	mode:value("11a", "802.11a")
	mode:value("11bg", "802.11b+g")
	mode:value("11gst", "802.11g + Turbo")
	mode:value("11ast", "802.11a + Turbo")
	mode:value("fh", translate("wifi_fh"))

	s:option(Flag, "diversity", translate("wifi_diversity")).rmempty = false

	if not nsantenna then
		s:option(Value, "txantenna", translate("wifi_txantenna")).optional = true
		s:option(Value, "rxantenna", translate("wifi_rxantenna")).optional = true
	else -- NanoFoo
		local ant = s:option(ListValue, "antenna", translate("wifi_txantenna"))
		ant:value("auto")
		ant:value("vertical")
		ant:value("horizontal")
		ant:value("external")
	end
	s:option(Value, "distance", translate("wifi_distance"),
		translate("wifi_distance_desc")).optional = true
	s:option(Value, "regdomain", translate("wifi_regdomain")).optional = true
	s:option(Value, "country", translate("wifi_country")).optional = true
	s:option(Flag, "outdoor", translate("wifi_outdoor")).optional = true

	--s:option(Flag, "nosbeacon", translate("wifi_nosbeacon")).optional = true
end



------------------- Broadcom Device ------------------

if hwtype == "broadcom" then
	s:option(Value, "txpower", translate("a_w_txpwr"), "dBm").rmempty = true

	mp = s:option(ListValue, "macfilter", translate("wifi_macpolicy"))
	mp.optional = true
	mp:value("")
	mp:value("allow", translate("wifi_whitelist"))
	mp:value("deny", translate("wifi_blacklist"))
	ml = s:option(DynamicList, "maclist", translate("wifi_maclist"))
	ml:depends({macfilter="allow"})
	ml:depends({macfilter="deny"})

	s:option(Value, "txantenna", translate("wifi_txantenna")).optional = true
	s:option(Value, "rxantenna", translate("wifi_rxantenna")).optional = true

	s:option(Flag, "frameburst", translate("wifi_bursting")).optional = true

	s:option(Value, "distance", translate("wifi_distance")).optional = true
	--s:option(Value, "slottime", translate("wifi_slottime")).optional = true

	s:option(Value, "country", translate("wifi_country")).optional = true
	s:option(Value, "maxassoc", translate("wifi_maxassoc")).optional = true
end


--------------------- HostAP Device ---------------------

if hwtype == "prism2" then
	s:option(Value, "txpower", translate("a_w_txpwr"), "att units").rmempty = true

	s:option(Flag, "diversity", translate("wifi_diversity")).rmempty = false

	s:option(Value, "txantenna", translate("wifi_txantenna")).optional = true
	s:option(Value, "rxantenna", translate("wifi_rxantenna")).optional = true
end


----------------------- Interface -----------------------

s = m:section(TypedSection, "wifi-iface", translate("interfaces"))
s.addremove = true
s.anonymous = true
s:depends("device", arg[1])
s.defaults.device = arg[1]

s:option(Value, "ssid", translate("wifi_essid"))

network = s:option(Value, "network", translate("network"), translate("a_w_network1"))
network.rmempty = true
network:value("")
network.combobox_manual = translate("a_w_netmanual")
luci.tools.webadmin.cbi_add_networks(network)

function network.write(self, section, value)
	if not m.uci:get("network", value) then
		-- avoid "value not defined in enum" because network is not known yet
		s.override_scheme = true

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
mode.override_values = true
mode:value("ap", translate("a_w_ap"))
mode:value("adhoc", translate("a_w_adhoc"))
mode:value("sta", translate("a_w_client"))

bssid = s:option(Value, "bssid", translate("wifi_bssid"))


-------------------- MAC80211 Interface ----------------------

if hwtype == "mac80211" then
	if luci.fs.mtime("/usr/sbin/iw") then
		mode:value("mesh", "802.11s")
	end

	mode:value("ahdemo", translate("a_w_ahdemo"))
	mode:value("monitor", translate("a_w_monitor"))
	bssid:depends({mode="adhoc"})

	s:option(Value, "frag", translate("wifi_frag")).optional = true
	s:option(Value, "rts", translate("wifi_rts")).optional = true
end



-------------------- Madwifi Interface ----------------------

if hwtype == "atheros" then
	mode:value("ahdemo", translate("a_w_ahdemo"))
	mode:value("monitor", translate("a_w_monitor"))

	bssid:depends({mode="adhoc"})
	bssid:depends({mode="ahdemo"})

	wds = s:option(Flag, "wds", translate("a_w_wds"))
	wds:depends({mode="ap"})
	wds:depends({mode="sta"})
	wds.rmempty = true
	wdssep = s:option(Flag, "wdssep", translate("wifi_wdssep"))
	wdssep:depends({mode="ap", wds="1"})
	wdssep.optional = true

	s:option(Flag, "doth", "802.11h").optional = true
	hidden = s:option(Flag, "hidden", translate("wifi_hidden"))
	hidden:depends({mode="ap"})
	hidden:depends({mode="adhoc"})
	hidden:depends({mode="wds"})
	hidden.optional = true
	isolate = s:option(Flag, "isolate", translate("wifi_isolate"),
	 translate("wifi_isolate_desc"))
	isolate:depends({mode="ap"})
	isolate.optional = true
	s:option(Flag, "bgscan", translate("wifi_bgscan")).optional = true

	mp = s:option(ListValue, "macpolicy", translate("wifi_macpolicy"))
	mp.optional = true
	mp:value("")
	mp:value("deny", translate("wifi_whitelist"))
	mp:value("allow", translate("wifi_blacklist"))
	ml = s:option(DynamicList, "maclist", translate("wifi_maclist"))
	ml:depends({macpolicy="allow"})
	ml:depends({macpolicy="deny"})

	s:option(Value, "rate", translate("wifi_rate")).optional = true
	s:option(Value, "mcast_rate", translate("wifi_mcast_rate")).optional = true
	s:option(Value, "frag", translate("wifi_frag")).optional = true
	s:option(Value, "rts", translate("wifi_rts")).optional = true
	s:option(Value, "minrate", translate("wifi_minrate")).optional = true
	s:option(Value, "maxrate", translate("wifi_maxrate")).optional = true
	s:option(Flag, "compression", translate("wifi_compression")).optional = true

	s:option(Flag, "bursting", translate("wifi_bursting")).optional = true
	s:option(Flag, "turbo", translate("wifi_turbo")).optional = true
	s:option(Flag, "ff", translate("wifi_ff")).optional = true

	s:option(Flag, "wmm", translate("wifi_wmm")).optional = true
	s:option(Flag, "xr", translate("wifi_xr")).optional = true
	s:option(Flag, "ar", translate("wifi_ar")).optional = true

	local swm = s:option(Flag, "sw_merge", translate("wifi_nosbeacon"))
	swm:depends({mode="adhoc"})
	swm.optional = true

	local nos = s:option(Flag, "nosbeacon", translate("wifi_nosbeacon"))
	nos:depends({mode="sta"})
	nos.optional = true

	local probereq = s:option(Flag, "probereq", translate("wifi_noprobereq"))
	probereq.optional = true
	probereq.enabled  = "0"
	probereq.disabled = "1"
end


-------------------- Broadcom Interface ----------------------

if hwtype == "broadcom" then
	mode:value("wds", translate("a_w_wds"))
	mode:value("monitor", translate("a_w_monitor"))

	hidden = s:option(Flag, "hidden", translate("wifi_hidden"))
	hidden:depends({mode="ap"})
	hidden:depends({mode="adhoc"})
	hidden:depends({mode="wds"})
	hidden.optional = true

	isolate = s:option(Flag, "isolate", translate("wifi_isolate"),
	 translate("wifi_isolate_desc"))
	isolate:depends({mode="ap"})
	isolate.optional = true

	bssid:depends({mode="wds"})
	bssid:depends({mode="adhoc"})
end


----------------------- HostAP Interface ---------------------

if hwtype == "prism2" then
	mode:value("wds", translate("a_w_wds"))
	mode:value("monitor", translate("a_w_monitor"))

	hidden = s:option(Flag, "hidden", translate("wifi_hidden"))
	hidden:depends({mode="ap"})
	hidden:depends({mode="adhoc"})
	hidden:depends({mode="wds"})
	hidden.optional = true

	bssid:depends({mode="sta"})

	mp = s:option(ListValue, "macpolicy", translate("wifi_macpolicy"))
	mp.optional = true
	mp:value("")
	mp:value("deny", translate("wifi_whitelist"))
	mp:value("allow", translate("wifi_blacklist"))
	ml = s:option(DynamicList, "maclist", translate("wifi_maclist"))
	ml:depends({macpolicy="allow"})
	ml:depends({macpolicy="deny"})

	s:option(Value, "rate", translate("wifi_rate")).optional = true
	s:option(Value, "frag", translate("wifi_frag")).optional = true
	s:option(Value, "rts", translate("wifi_rts")).optional = true
end


------------------- WiFI-Encryption -------------------

encr = s:option(ListValue, "encryption", translate("encryption"))
encr.override_values = true
encr:depends({mode="ap"})
encr:depends({mode="sta"})
encr:depends({mode="adhoc"})
encr:depends({mode="ahdemo"})
encr:depends({mode="wds"})
encr:depends({mode="mesh"})

encr:value("none", "No Encryption")
encr:value("wep", "WEP")

if hwtype == "atheros" or hwtype == "mac80211" or hwtype == "prism2" then
	local supplicant = luci.fs.mtime("/usr/sbin/wpa_supplicant")
	local hostapd = luci.fs.mtime("/usr/sbin/hostapd")

	if hostapd and supplicant then
		encr:value("psk", "WPA-PSK")
		encr:value("psk2", "WPA2-PSK")
		encr:value("mixed", "WPA-PSK/WPA2-PSK Mixed Mode")
		encr:value("wpa", "WPA-EAP", {mode="ap"}, {mode="sta"})
		encr:value("wpa2", "WPA2-EAP", {mode="ap"}, {mode="sta"})
	elseif hostapd and not supplicant then
		encr:value("psk", "WPA-PSK", {mode="ap"}, {mode="adhoc"}, {mode="ahdemo"})
		encr:value("psk2", "WPA2-PSK", {mode="ap"}, {mode="adhoc"}, {mode="ahdemo"})
		encr:value("mixed", "WPA-PSK/WPA2-PSK Mixed Mode", {mode="ap"}, {mode="adhoc"}, {mode="ahdemo"})
		encr:value("wpa", "WPA-EAP", {mode="ap"})
		encr:value("wpa2", "WPA2-EAP", {mode="ap"})
		encr.description = translate("wifi_wpareq")
	elseif not hostapd and supplicant then
		encr:value("psk", "WPA-PSK", {mode="sta"})
		encr:value("psk2", "WPA2-PSK", {mode="sta"})
		encr:value("mixed", "WPA-PSK/WPA2-PSK Mixed Mode", {mode="sta"})
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

encr:depends("mode", "ap")
encr:depends("mode", "sta")
encr:depends("mode", "wds")

server = s:option(Value, "server", translate("a_w_radiussrv"))
server:depends({mode="ap", encryption="wpa"})
server:depends({mode="ap", encryption="wpa2"})
server.rmempty = true

port = s:option(Value, "port", translate("a_w_radiusport"))
port:depends({mode="ap", encryption="wpa"})
port:depends({mode="ap", encryption="wpa2"})
port.rmempty = true

key = s:option(Value, "key", translate("key"))
key:depends("encryption", "wep")
key:depends("encryption", "psk")
key:depends("encryption", "psk2")
key:depends("encryption", "psk+psk2")
key:depends("encryption", "mixed")
key:depends({mode="ap", encryption="wpa"})
key:depends({mode="ap", encryption="wpa2"})
key.rmempty = true
key.password = true

if hwtype == "atheros" or hwtype == "mac80211" or hwtype == "prism2" then
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


return m
