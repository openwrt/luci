--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--

local wa = require "luci.tools.webadmin"
local nw = require "luci.model.network"
local fs = require "nixio.fs"

arg[1] = arg[1] or ""
arg[2] = arg[2] or ""

m = Map("wireless", translate("networks"), translate("a_w_networks1"))
m:chain("network")
nw.init(m.uci)

local iw = nil
local tx_powers = nil

m.uci:foreach("wireless", "wifi-iface",
	function(s)
		if s.device == arg[1] and not iw then
			iw = luci.sys.wifi.getiwinfo(s.ifname or s.device)
			tx_powers = iw.txpwrlist or { }
		end
	end)

s = m:section(NamedSection, arg[1], "wifi-device", translate("device") .. " " .. arg[1])
s.addremove = false

s:tab("general", translate("a_w_general", "General Setup"))
s:tab("macfilter", translate("a_w_macfilter", "MAC-Filter"))
s:tab("advanced", translate("a_w_advanced", "Advanced Settings"))

--[[
back = s:option(DummyValue, "_overview", translate("overview"))
back.value = ""
back.titleref = luci.dispatcher.build_url("admin", "network", "wireless")
]]

en = s:taboption("general", Flag, "disabled", translate("enable"))
en.enabled = "0"
en.disabled = "1"
en.rmempty = false

function en.cfgvalue(self, section)
	return Flag.cfgvalue(self, section) or "0"
end

s:taboption("general", DummyValue, "type", translate("type"))

local hwtype = m:get(arg[1], "type")
-- NanoFoo
local nsantenna = m:get(arg[1], "antenna")

ch = s:taboption("general", Value, "channel", translate("a_w_channel"))
ch:value("auto", translate("wifi_auto"))
for c, f in luci.util.kspairs(luci.sys.wifi.channels()) do
	ch:value(c, "%i (%.3f GHz)" %{ c, f })
end


------------------- MAC80211 Device ------------------

if hwtype == "mac80211" then
	tp = s:taboption("general",
		(tx_powers and #tx_powers > 0) and ListValue or Value,
		"txpower", translate("a_w_txpwr"), "dBm")

	tp.rmempty = true
	for _, p in ipairs(iw and iw.txpwrlist or {}) do
		tp:value(p.dbm, "%i dBm (%i mW)" %{ p.dbm, p.mw })
	end
end


------------------- Madwifi Device ------------------

if hwtype == "atheros" then
	tp = s:taboption("general",
		(#tx_powers > 0) and ListValue or Value,
		"txpower", translate("a_w_txpwr"), "dBm")

	tp.rmempty = true
	for _, p in ipairs(iw.txpwrlist) do
		tp:value(p.dbm, "%i dBm (%i mW)" %{ p.dbm, p.mw })
	end

	mode = s:taboption("advanced", ListValue, "hwmode", translate("mode"))
	mode:value("", translate("wifi_auto"))
	mode:value("11b", "802.11b")
	mode:value("11g", "802.11g")
	mode:value("11a", "802.11a")
	mode:value("11bg", "802.11b+g")
	mode:value("11gst", "802.11g + Turbo")
	mode:value("11ast", "802.11a + Turbo")
	mode:value("fh", translate("wifi_fh"))

	s:taboption("advanced", Flag, "diversity", translate("wifi_diversity")).rmempty = false

	if not nsantenna then
		ant1 = s:taboption("advanced", ListValue, "txantenna", translate("wifi_txantenna"))
		ant1.widget = "radio"
		ant1.orientation = "horizontal"
		ant1:depends("diversity", "")
		ant1:value("0", translate("wifi_auto"))
		ant1:value("1", translate("wifi_ant1", "Antenna 1"))
		ant1:value("2", translate("wifi_ant2", "Antenna 2"))

		ant2 = s:taboption("advanced", ListValue, "rxantenna", translate("wifi_rxantenna"))
		ant2.widget = "radio"
		ant2.orientation = "horizontal"
		ant2:depends("diversity", "")
		ant2:value("0", translate("wifi_auto"))
		ant2:value("1", translate("wifi_ant1", "Antenna 1"))
		ant2:value("2", translate("wifi_ant2", "Antenna 2"))

	else -- NanoFoo
		local ant = s:taboption("advanced", ListValue, "antenna", translate("wifi_txantenna"))
		ant:value("auto")
		ant:value("vertical")
		ant:value("horizontal")
		ant:value("external")
	end

	s:taboption("advanced", Value, "distance", translate("wifi_distance"),
		translate("wifi_distance_desc"))
	s:taboption("advanced", Value, "regdomain", translate("wifi_regdomain"))
	s:taboption("advanced", Value, "country", translate("wifi_country"))
	s:taboption("advanced", Flag, "outdoor", translate("wifi_outdoor"))

	--s:option(Flag, "nosbeacon", translate("wifi_nosbeacon"))
end



------------------- Broadcom Device ------------------

if hwtype == "broadcom" then
	tp = s:taboption("general",
		(#tx_powers > 0) and ListValue or Value,
		"txpower", translate("a_w_txpwr"), "dBm")

	tp.rmempty = true
	for _, p in ipairs(iw.txpwrlist) do
		tp:value(p.dbm, "%i dBm (%i mW)" %{ p.dbm, p.mw })
	end	

	mp = s:taboption("macfilter", ListValue, "macfilter", translate("wifi_macpolicy"))
	mp:value("", translate("disable"))
	mp:value("allow", translate("wifi_whitelist"))
	mp:value("deny", translate("wifi_blacklist"))
	ml = s:taboption("macfilter", DynamicList, "maclist", translate("wifi_maclist"))
	ml:depends({macfilter="allow"})
	ml:depends({macfilter="deny"})

	ant1 = s:taboption("advanced", ListValue, "txantenna", translate("wifi_txantenna"))
	ant1.widget = "radio"
	ant1:depends("diversity", "")
	ant1:value("3", translate("wifi_auto"))
	ant1:value("0", translate("wifi_ant1", "Antenna 1"))
	ant1:value("1", translate("wifi_ant2", "Antenna 2"))

	ant2 = s:taboption("advanced", ListValue, "rxantenna", translate("wifi_rxantenna"))
	ant2.widget = "radio"
	ant2:depends("diversity", "")
	ant2:value("3", translate("wifi_auto"))
	ant2:value("0", translate("wifi_ant1", "Antenna 1"))
	ant2:value("1", translate("wifi_ant2", "Antenna 2"))

	s:taboption("advanced", Flag, "frameburst", translate("wifi_bursting"))

	s:taboption("advanced", Value, "distance", translate("wifi_distance"))
	--s:option(Value, "slottime", translate("wifi_slottime"))

	s:taboption("advanced", Value, "country", translate("wifi_country"))
	s:taboption("advanced", Value, "maxassoc", translate("wifi_maxassoc"))
end


--------------------- HostAP Device ---------------------

if hwtype == "prism2" then
	s:taboption("advanced", Value, "txpower", translate("a_w_txpwr"), "att units").rmempty = true

	s:taboption("advanced", Flag, "diversity", translate("wifi_diversity")).rmempty = false

	s:taboption("advanced", Value, "txantenna", translate("wifi_txantenna"))
	s:taboption("advanced", Value, "rxantenna", translate("wifi_rxantenna"))
end


----------------------- Interface -----------------------

s = m:section(NamedSection, arg[2], "wifi-iface", translate("interfaces"))
s.addremove = false
s.anonymous = true
s.defaults.device = arg[1]

s:tab("general", translate("a_w_general", "General Setup"))
s:tab("encryption", translate("a_w_security", "Wireless Security"))
s:tab("macfilter", translate("a_w_macfilter", "MAC-Filter"))
s:tab("advanced", translate("a_w_advanced", "Advanced Settings"))

s:taboption("general", Value, "ssid", translate("wifi_essid"))

mode = s:taboption("general", ListValue, "mode", translate("mode"))
mode.override_values = true
mode:value("ap", translate("a_w_ap"))
mode:value("sta", translate("a_w_client"))
mode:value("adhoc", translate("a_w_adhoc"))

bssid = s:taboption("general", Value, "bssid", translate("wifi_bssid"))

network = s:taboption("general", Value, "network", translate("network"), translate("a_w_network1"))
network.rmempty = true
network.template = "cbi/network_netlist"
network.widget = "radio"

function network.write(self, section, value)
	local i = nw:get_interface(section)
	if i then
		if value == '-' then
			value = m:formvalue(self:cbid(section) .. ".newnet")
			if value and #value > 0 then
				local n = nw:add_network(value, {type="bridge", proto="none"})
				if n then n:add_interface(i) end
			else
				local n = i:get_network()
				if n then n:del_interface(i) end
			end
		else
			local n = nw:get_network(value)
			if n then
				n:type("bridge")
				n:add_interface(i)
			end
		end
	end
end

-------------------- MAC80211 Interface ----------------------

if hwtype == "mac80211" then
	if fs.access("/usr/sbin/iw") then
		mode:value("mesh", "802.11s")
	end

	mode:value("ahdemo", translate("a_w_ahdemo"))
	mode:value("monitor", translate("a_w_monitor"))
	bssid:depends({mode="adhoc"})

	s:taboption("advanced", Value, "frag", translate("wifi_frag"))
	s:taboption("advanced", Value, "rts", translate("wifi_rts"))
end



-------------------- Madwifi Interface ----------------------

if hwtype == "atheros" then
	mode:value("ahdemo", translate("a_w_ahdemo"))
	mode:value("monitor", translate("a_w_monitor"))
	mode:value("ap-wds", "%s (%s)" % {translate("a_w_ap"), translate("a_w_wds")})
	mode:value("sta-wds", "%s (%s)" % {translate("a_w_client"), translate("a_w_wds")})

	function mode.write(self, section, value)
		if value == "ap-wds" then
			ListValue.write(self, section, "ap")
			m.uci:set("wireless", section, "wds", 1)
		elseif value == "sta-wds" then
			ListValue.write(self, section, "sta")
			m.uci:set("wireless", section, "wds", 1)
		else
			ListValue.write(self, section, value)
			m.uci:delete("wireless", section, "wds")
		end
	end

	function mode.cfgvalue(self, section)
		local mode = ListValue.cfgvalue(self, section)
		local wds  = m.uci:get("wireless", section, "wds") == "1"

		if mode == "ap" and wds then
			return "ap-wds"
		elseif mode == "sta" and wds then
			return "sta-wds"
		else
			return mode
		end
	end

	bssid:depends({mode="adhoc"})
	bssid:depends({mode="ahdemo"})

	wdssep = s:taboption("advanced", Flag, "wdssep", translate("wifi_wdssep"))
	wdssep:depends({mode="ap-wds"})

	s:taboption("advanced", Flag, "doth", "802.11h")
	hidden = s:taboption("general", Flag, "hidden", translate("wifi_hidden"))
	hidden:depends({mode="ap"})
	hidden:depends({mode="adhoc"})
	hidden:depends({mode="ap-wds"})
	hidden:depends({mode="sta-wds"})
	isolate = s:taboption("advanced", Flag, "isolate", translate("wifi_isolate"),
	 translate("wifi_isolate_desc"))
	isolate:depends({mode="ap"})
	s:taboption("advanced", Flag, "bgscan", translate("wifi_bgscan"))

	mp = s:taboption("macfilter", ListValue, "macpolicy", translate("wifi_macpolicy"))
	mp:value("", translate("disable"))
	mp:value("deny", translate("wifi_whitelist"))
	mp:value("allow", translate("wifi_blacklist"))
	ml = s:taboption("macfilter", DynamicList, "maclist", translate("wifi_maclist"))
	ml:depends({macpolicy="allow"})
	ml:depends({macpolicy="deny"})

	s:taboption("advanced", Value, "rate", translate("wifi_rate"))
	s:taboption("advanced", Value, "mcast_rate", translate("wifi_mcast_rate"))
	s:taboption("advanced", Value, "frag", translate("wifi_frag"))
	s:taboption("advanced", Value, "rts", translate("wifi_rts"))
	s:taboption("advanced", Value, "minrate", translate("wifi_minrate"))
	s:taboption("advanced", Value, "maxrate", translate("wifi_maxrate"))
	s:taboption("advanced", Flag, "compression", translate("wifi_compression"))

	s:taboption("advanced", Flag, "bursting", translate("wifi_bursting"))
	s:taboption("advanced", Flag, "turbo", translate("wifi_turbo"))
	s:taboption("advanced", Flag, "ff", translate("wifi_ff"))

	s:taboption("advanced", Flag, "wmm", translate("wifi_wmm"))
	s:taboption("advanced", Flag, "xr", translate("wifi_xr"))
	s:taboption("advanced", Flag, "ar", translate("wifi_ar"))

	local swm = s:taboption("advanced", Flag, "sw_merge", translate("wifi_nosbeacon"))
	swm:depends({mode="adhoc"})

	local nos = s:taboption("advanced", Flag, "nosbeacon", translate("wifi_nosbeacon"))
	nos:depends({mode="sta"})
	nos:depends({mode="sta-wds"})

	local probereq = s:taboption("advanced", Flag, "probereq", translate("wifi_noprobereq"))
	probereq.enabled  = "0"
	probereq.disabled = "1"
end


-------------------- Broadcom Interface ----------------------

if hwtype == "broadcom" then
	mode:value("wds", translate("a_w_wds"))
	mode:value("monitor", translate("a_w_monitor"))

	hidden = s:taboption("general", Flag, "hidden", translate("wifi_hidden"))
	hidden:depends({mode="ap"})
	hidden:depends({mode="adhoc"})
	hidden:depends({mode="wds"})

	isolate = s:taboption("advanced", Flag, "isolate", translate("wifi_isolate"),
	 translate("wifi_isolate_desc"))
	isolate:depends({mode="ap"})

	s:taboption("advanced", Flag, "doth", "802.11h")
	s:taboption("advanced", Flag, "wmm", translate("wifi_wmm"))

	bssid:depends({mode="wds"})
	bssid:depends({mode="adhoc"})
end


----------------------- HostAP Interface ---------------------

if hwtype == "prism2" then
	mode:value("wds", translate("a_w_wds"))
	mode:value("monitor", translate("a_w_monitor"))

	hidden = s:taboption("general", Flag, "hidden", translate("wifi_hidden"))
	hidden:depends({mode="ap"})
	hidden:depends({mode="adhoc"})
	hidden:depends({mode="wds"})

	bssid:depends({mode="sta"})

	mp = s:taboption("macfilter", ListValue, "macpolicy", translate("wifi_macpolicy"))
	mp:value("", translate("disable"))
	mp:value("deny", translate("wifi_whitelist"))
	mp:value("allow", translate("wifi_blacklist"))
	ml = s:taboption("macfilter", DynamicList, "maclist", translate("wifi_maclist"))
	ml:depends({macpolicy="allow"})
	ml:depends({macpolicy="deny"})

	s:taboption("advanced", Value, "rate", translate("wifi_rate"))
	s:taboption("advanced", Value, "frag", translate("wifi_frag"))
	s:taboption("advanced", Value, "rts", translate("wifi_rts"))
end


------------------- WiFI-Encryption -------------------

encr = s:taboption("encryption", ListValue, "encryption", translate("encryption"))
encr.override_values = true
encr:depends({mode="ap"})
encr:depends({mode="sta"})
encr:depends({mode="adhoc"})
encr:depends({mode="ahdemo"})
encr:depends({mode="ap-wds"})
encr:depends({mode="sta-wds"})
encr:depends({mode="mesh"})

encr:value("none", "No Encryption")
encr:value("wep", "WEP")

if hwtype == "atheros" or hwtype == "mac80211" or hwtype == "prism2" then
	local supplicant = fs.access("/usr/sbin/wpa_supplicant")
	local hostapd = fs.access("/usr/sbin/hostapd")

	if hostapd and supplicant then
		encr:value("psk", "WPA-PSK")
		encr:value("psk2", "WPA2-PSK")
		encr:value("psk-mixed", "WPA-PSK/WPA2-PSK Mixed Mode")
		encr:value("wpa", "WPA-EAP", {mode="ap"}, {mode="sta"}, {mode="ap-wds"}, {mode="sta-wds"})
		encr:value("wpa2", "WPA2-EAP", {mode="ap"}, {mode="sta"})
	elseif hostapd and not supplicant then
		encr:value("psk", "WPA-PSK", {mode="ap"}, {mode="ap-wds"}, {mode="adhoc"}, {mode="ahdemo"})
		encr:value("psk2", "WPA2-PSK", {mode="ap"}, {mode="ap-wds"}, {mode="adhoc"}, {mode="ahdemo"})
		encr:value("psk-mixed", "WPA-PSK/WPA2-PSK Mixed Mode", {mode="ap"}, {mode="ap-wds"}, {mode="adhoc"}, {mode="ahdemo"})
		encr:value("wpa", "WPA-EAP", {mode="ap"}, {mode="ap-wds"})
		encr:value("wpa2", "WPA2-EAP", {mode="ap"}, {mode="ap-wds"})
		encr.description = translate("wifi_wpareq")
	elseif not hostapd and supplicant then
		encr:value("psk", "WPA-PSK", {mode="sta"}, {mode="sta-wds"})
		encr:value("psk2", "WPA2-PSK", {mode="sta"}, {mode="sta-wds"})
		encr:value("psk-mixed", "WPA-PSK/WPA2-PSK Mixed Mode", {mode="sta"}, {mode="sta-wds"})
		encr:value("wpa", "WPA-EAP", {mode="sta"}, {mode="sta-wds"})
		encr:value("wpa2", "WPA2-EAP", {mode="sta"}, {mode="sta-wds"})
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
encr:depends("mode", "ap-wds")
encr:depends("mode", "sta-wds")
encr:depends("mode", "wds")

server = s:taboption("encryption", Value, "server", translate("a_w_radiussrv"))
server:depends({mode="ap", encryption="wpa"})
server:depends({mode="ap", encryption="wpa2"})
server.rmempty = true

port = s:taboption("encryption", Value, "port", translate("a_w_radiusport"))
port:depends({mode="ap", encryption="wpa"})
port:depends({mode="ap", encryption="wpa2"})
port.rmempty = true

key = s:taboption("encryption", Value, "key", translate("key"))
key:depends("encryption", "wep")
key:depends("encryption", "psk")
key:depends("encryption", "psk2")
key:depends("encryption", "psk+psk2")
key:depends("encryption", "psk-mixed")
key:depends({mode="ap", encryption="wpa"})
key:depends({mode="ap", encryption="wpa2"})
key.rmempty = true
key.password = true

if hwtype == "atheros" or hwtype == "mac80211" or hwtype == "prism2" then
	nasid = s:taboption("encryption", Value, "nasid", translate("a_w_nasid"))
	nasid:depends({mode="ap", encryption="wpa"})
	nasid:depends({mode="ap", encryption="wpa2"})
	nasid.rmempty = true

	eaptype = s:taboption("encryption", ListValue, "eap_type", translate("a_w_eaptype"))
	eaptype:value("TLS")
	eaptype:value("TTLS")
	eaptype:value("PEAP")
	eaptype:depends({mode="sta", encryption="wpa"})
	eaptype:depends({mode="sta", encryption="wpa2"})

	cacert = s:taboption("encryption", FileUpload, "ca_cert", translate("a_w_cacert"))
	cacert:depends({mode="sta", encryption="wpa"})
	cacert:depends({mode="sta", encryption="wpa2"})

	privkey = s:taboption("encryption", FileUpload, "priv_key", translate("a_w_tlsprivkey"))
	privkey:depends({mode="sta", eap_type="TLS", encryption="wpa2"})
	privkey:depends({mode="sta", eap_type="TLS", encryption="wpa"})

	privkeypwd = s:taboption("encryption", Value, "priv_key_pwd", translate("a_w_tlsprivkeypwd"))
	privkeypwd:depends({mode="sta", eap_type="TLS", encryption="wpa2"})
	privkeypwd:depends({mode="sta", eap_type="TLS", encryption="wpa"})


	auth = s:taboption("encryption", Value, "auth", translate("a_w_peapauth"))
	auth:value("PAP")
	auth:value("CHAP")
	auth:value("MSCHAP")
	auth:value("MSCHAPV2")
	auth:depends({mode="sta", eap_type="PEAP", encryption="wpa2"})
	auth:depends({mode="sta", eap_type="PEAP", encryption="wpa"})
	auth:depends({mode="sta", eap_type="TTLS", encryption="wpa2"})
	auth:depends({mode="sta", eap_type="TTLS", encryption="wpa"})


	identity = s:taboption("encryption", Value, "identity", translate("a_w_peapidentity"))
	identity:depends({mode="sta", eap_type="PEAP", encryption="wpa2"})
	identity:depends({mode="sta", eap_type="PEAP", encryption="wpa"})
	identity:depends({mode="sta", eap_type="TTLS", encryption="wpa2"})
	identity:depends({mode="sta", eap_type="TTLS", encryption="wpa"})

	password = s:taboption("encryption", Value, "password", translate("a_w_peappassword"))
	password:depends({mode="sta", eap_type="PEAP", encryption="wpa2"})
	password:depends({mode="sta", eap_type="PEAP", encryption="wpa"})
	password:depends({mode="sta", eap_type="TTLS", encryption="wpa2"})
	password:depends({mode="sta", eap_type="TTLS", encryption="wpa"})
end


return m
