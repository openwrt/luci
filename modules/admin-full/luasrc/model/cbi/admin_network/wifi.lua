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
local ww = require "luci.model.wireless"
local fs = require "nixio.fs"

arg[1] = arg[1] or ""
arg[2] = arg[2] or ""

m = Map("wireless", "",
	translate("The <em>Device Configuration</em> section covers physical settings of the radio " ..
		"hardware such as channel, transmit power or antenna selection which is shared among all " ..
		"defined wireless networks (if the radio hardware is multi-SSID capable). Per network settings " ..
		"like encryption or operation mode are grouped in the <em>Interface Configuration</em>."))

m:chain("network")

local ifsection

function m.on_commit(map)
	nw.init(map.uci)
	ww.init(map.uci)

	local wnet = ww:get_network(arg[2])
	if ifsection and wnet then
		ifsection.section = wnet.sid
	end
end

nw.init(m.uci)
ww.init(m.uci)

local wnet = ww:get_network(arg[2])
m.title = wnet and ww:get_i18n(wnet) or translate("Wireless Network")


local iw = nil
local tx_powers = nil

m.uci:foreach("wireless", "wifi-iface",
	function(s)
		if s.device == arg[1] and not iw then
			iw = luci.sys.wifi.getiwinfo(s.ifname or s.device)
			tx_powers = iw.txpwrlist or { }
		end
	end)

s = m:section(NamedSection, arg[1], "wifi-device", translate("Device Configuration"))
s.addremove = false

s:tab("general", translate("General Setup"))
s:tab("macfilter", translate("MAC-Filter"))
s:tab("advanced", translate("Advanced Settings"))

--[[
back = s:option(DummyValue, "_overview", translate("Overview"))
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

s:taboption("general", DummyValue, "type", translate("Type"))

local hwtype = m:get(arg[1], "type")
-- NanoFoo
local nsantenna = m:get(arg[1], "antenna")

ch = s:taboption("general", Value, "channel", translate("Channel"))
ch:value("auto", translate("auto"))
for _, f in ipairs(luci.sys.wifi.channels()) do
	ch:value(f.channel, "%i (%.3f GHz)" %{ f.channel, f.mhz / 1000 })
end


------------------- MAC80211 Device ------------------

if hwtype == "mac80211" then
	tp = s:taboption("general",
		(tx_powers and #tx_powers > 0) and ListValue or Value,
		"txpower", translate("Transmit Power"), "dBm")

	tp.rmempty = true
	for _, p in ipairs(iw and iw.txpwrlist or {}) do
		tp:value(p.dbm, "%i dBm (%i mW)" %{ p.dbm, p.mw })
	end
end


------------------- Madwifi Device ------------------

if hwtype == "atheros" then
	tp = s:taboption("general",
		(#tx_powers > 0) and ListValue or Value,
		"txpower", translate("Transmit Power"), "dBm")

	tp.rmempty = true
	for _, p in ipairs(iw.txpwrlist) do
		tp:value(p.dbm, "%i dBm (%i mW)" %{ p.dbm, p.mw })
	end

	mode = s:taboption("advanced", ListValue, "hwmode", translate("Mode"))
	mode:value("", translate("auto"))
	mode:value("11b", "802.11b")
	mode:value("11g", "802.11g")
	mode:value("11a", "802.11a")
	mode:value("11bg", "802.11b+g")
	mode:value("11gst", "802.11g + Turbo")
	mode:value("11ast", "802.11a + Turbo")
	mode:value("fh", translate("Frequency Hopping"))

	s:taboption("advanced", Flag, "diversity", translate("Diversity")).rmempty = false

	if not nsantenna then
		ant1 = s:taboption("advanced", ListValue, "txantenna", translate("Transmitter Antenna"))
		ant1.widget = "radio"
		ant1.orientation = "horizontal"
		ant1:depends("diversity", "")
		ant1:value("0", translate("auto"))
		ant1:value("1", translate("Antenna 1"))
		ant1:value("2", translate("Antenna 2"))

		ant2 = s:taboption("advanced", ListValue, "rxantenna", translate("Receiver Antenna"))
		ant2.widget = "radio"
		ant2.orientation = "horizontal"
		ant2:depends("diversity", "")
		ant2:value("0", translate("auto"))
		ant2:value("1", translate("Antenna 1"))
		ant2:value("2", translate("Antenna 2"))

	else -- NanoFoo
		local ant = s:taboption("advanced", ListValue, "antenna", translate("Transmitter Antenna"))
		ant:value("auto")
		ant:value("vertical")
		ant:value("horizontal")
		ant:value("external")
	end

	s:taboption("advanced", Value, "distance", translate("Distance Optimization"),
		translate("Distance to farthest network member in meters."))
	s:taboption("advanced", Value, "regdomain", translate("Regulatory Domain"))
	s:taboption("advanced", Value, "country", translate("Country Code"))
	s:taboption("advanced", Flag, "outdoor", translate("Outdoor Channels"))

	--s:option(Flag, "nosbeacon", translate("Disable HW-Beacon timer"))
end



------------------- Broadcom Device ------------------

if hwtype == "broadcom" then
	tp = s:taboption("general",
		(#tx_powers > 0) and ListValue or Value,
		"txpower", translate("Transmit Power"), "dBm")

	tp.rmempty = true
	for _, p in ipairs(iw.txpwrlist) do
		tp:value(p.dbm, "%i dBm (%i mW)" %{ p.dbm, p.mw })
	end	

	mp = s:taboption("macfilter", ListValue, "macfilter", translate("MAC-Address Filter"))
	mp:value("", translate("disable"))
	mp:value("allow", translate("Allow listed only"))
	mp:value("deny", translate("Allow all except listed"))
	ml = s:taboption("macfilter", DynamicList, "maclist", translate("MAC-List"))
	ml:depends({macfilter="allow"})
	ml:depends({macfilter="deny"})

	ant1 = s:taboption("advanced", ListValue, "txantenna", translate("Transmitter Antenna"))
	ant1.widget = "radio"
	ant1:depends("diversity", "")
	ant1:value("3", translate("auto"))
	ant1:value("0", translate("Antenna 1"))
	ant1:value("1", translate("Antenna 2"))

	ant2 = s:taboption("advanced", ListValue, "rxantenna", translate("Receiver Antenna"))
	ant2.widget = "radio"
	ant2:depends("diversity", "")
	ant2:value("3", translate("auto"))
	ant2:value("0", translate("Antenna 1"))
	ant2:value("1", translate("Antenna 2"))

	s:taboption("advanced", Flag, "frameburst", translate("Frame Bursting"))

	s:taboption("advanced", Value, "distance", translate("Distance Optimization"))
	--s:option(Value, "slottime", translate("Slot time"))

	s:taboption("advanced", Value, "country", translate("Country Code"))
	s:taboption("advanced", Value, "maxassoc", translate("Connection Limit"))
end


--------------------- HostAP Device ---------------------

if hwtype == "prism2" then
	s:taboption("advanced", Value, "txpower", translate("Transmit Power"), "att units").rmempty = true

	s:taboption("advanced", Flag, "diversity", translate("Diversity")).rmempty = false

	s:taboption("advanced", Value, "txantenna", translate("Transmitter Antenna"))
	s:taboption("advanced", Value, "rxantenna", translate("Receiver Antenna"))
end


----------------------- Interface -----------------------

local wnet = ww:get_network(arg[2])

if wnet then
	s = m:section(NamedSection, wnet.sid, "wifi-iface", translate("Interface Configuration"))
	ifsection = s
	s.addremove = false
	s.anonymous = true
	s.defaults.device = arg[1]

	s:tab("general", translate("General Setup"))
	s:tab("encryption", translate("Wireless Security"))
	s:tab("macfilter", translate("MAC-Filter"))
	s:tab("advanced", translate("Advanced Settings"))

	s:taboption("general", Value, "ssid", translate("<abbr title=\"Extended Service Set Identifier\">ESSID</abbr>"))

	mode = s:taboption("general", ListValue, "mode", translate("Mode"))
	mode.override_values = true
	mode:value("ap", translate("Access Point"))
	mode:value("sta", translate("Client"))
	mode:value("adhoc", translate("Ad-Hoc"))

	bssid = s:taboption("general", Value, "bssid", translate("<abbr title=\"Basic Service Set Identifier\">BSSID</abbr>"))

	network = s:taboption("general", Value, "network", translate("Network"),
		translate("Choose the network you want to attach to this wireless interface. " ..
			"Select <em>unspecified</em> to not attach any network or fill out the " ..
			"<em>create</em> field to define a new network."))

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

		mode:value("ahdemo", translate("Pseudo Ad-Hoc (ahdemo)"))
		mode:value("monitor", translate("Monitor"))
		bssid:depends({mode="adhoc"})

		s:taboption("advanced", Value, "frag", translate("Fragmentation Threshold"))
		s:taboption("advanced", Value, "rts", translate("RTS/CTS Threshold"))
	end



	-------------------- Madwifi Interface ----------------------

	if hwtype == "atheros" then
		mode:value("ahdemo", translate("Pseudo Ad-Hoc (ahdemo)"))
		mode:value("monitor", translate("Monitor"))
		mode:value("ap-wds", "%s (%s)" % {translate("Access Point"), translate("WDS")})
		mode:value("sta-wds", "%s (%s)" % {translate("Client"), translate("WDS")})
		mode:value("wds", translate("Static WDS"))

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
		bssid:depends({mode="wds"})

		wdssep = s:taboption("advanced", Flag, "wdssep", translate("Separate WDS"))
		wdssep:depends({mode="ap-wds"})

		s:taboption("advanced", Flag, "doth", "802.11h")
		hidden = s:taboption("general", Flag, "hidden", translate("Hide <abbr title=\"Extended Service Set Identifier\">ESSID</abbr>"))
		hidden:depends({mode="ap"})
		hidden:depends({mode="adhoc"})
		hidden:depends({mode="ap-wds"})
		hidden:depends({mode="sta-wds"})
		isolate = s:taboption("advanced", Flag, "isolate", translate("Separate Clients"),
		 translate("Prevents client-to-client communication"))
		isolate:depends({mode="ap"})
		s:taboption("advanced", Flag, "bgscan", translate("Background Scan"))

		mp = s:taboption("macfilter", ListValue, "macpolicy", translate("MAC-Address Filter"))
		mp:value("", translate("disable"))
		mp:value("deny", translate("Allow listed only"))
		mp:value("allow", translate("Allow all except listed"))
		ml = s:taboption("macfilter", DynamicList, "maclist", translate("MAC-List"))
		ml:depends({macpolicy="allow"})
		ml:depends({macpolicy="deny"})

		s:taboption("advanced", Value, "rate", translate("Transmission Rate"))
		s:taboption("advanced", Value, "mcast_rate", translate("Multicast Rate"))
		s:taboption("advanced", Value, "frag", translate("Fragmentation Threshold"))
		s:taboption("advanced", Value, "rts", translate("RTS/CTS Threshold"))
		s:taboption("advanced", Value, "minrate", translate("Minimum Rate"))
		s:taboption("advanced", Value, "maxrate", translate("Maximum Rate"))
		s:taboption("advanced", Flag, "compression", translate("Compression"))

		s:taboption("advanced", Flag, "bursting", translate("Frame Bursting"))
		s:taboption("advanced", Flag, "turbo", translate("Turbo Mode"))
		s:taboption("advanced", Flag, "ff", translate("Fast Frames"))

		s:taboption("advanced", Flag, "wmm", translate("WMM Mode"))
		s:taboption("advanced", Flag, "xr", translate("XR Support"))
		s:taboption("advanced", Flag, "ar", translate("AR Support"))

		local swm = s:taboption("advanced", Flag, "sw_merge", translate("Disable HW-Beacon timer"))
		swm:depends({mode="adhoc"})

		local nos = s:taboption("advanced", Flag, "nosbeacon", translate("Disable HW-Beacon timer"))
		nos:depends({mode="sta"})
		nos:depends({mode="sta-wds"})

		local probereq = s:taboption("advanced", Flag, "probereq", translate("Do not send probe responses"))
		probereq.enabled  = "0"
		probereq.disabled = "1"
	end


	-------------------- Broadcom Interface ----------------------

	if hwtype == "broadcom" then
		mode:value("wds", translate("WDS"))
		mode:value("monitor", translate("Monitor"))

		hidden = s:taboption("general", Flag, "hidden", translate("Hide <abbr title=\"Extended Service Set Identifier\">ESSID</abbr>"))
		hidden:depends({mode="ap"})
		hidden:depends({mode="adhoc"})
		hidden:depends({mode="wds"})

		isolate = s:taboption("advanced", Flag, "isolate", translate("Separate Clients"),
		 translate("Prevents client-to-client communication"))
		isolate:depends({mode="ap"})

		s:taboption("advanced", Flag, "doth", "802.11h")
		s:taboption("advanced", Flag, "wmm", translate("WMM Mode"))

		bssid:depends({mode="wds"})
		bssid:depends({mode="adhoc"})
	end


	----------------------- HostAP Interface ---------------------

	if hwtype == "prism2" then
		mode:value("wds", translate("WDS"))
		mode:value("monitor", translate("Monitor"))

		hidden = s:taboption("general", Flag, "hidden", translate("Hide <abbr title=\"Extended Service Set Identifier\">ESSID</abbr>"))
		hidden:depends({mode="ap"})
		hidden:depends({mode="adhoc"})
		hidden:depends({mode="wds"})

		bssid:depends({mode="sta"})

		mp = s:taboption("macfilter", ListValue, "macpolicy", translate("MAC-Address Filter"))
		mp:value("", translate("disable"))
		mp:value("deny", translate("Allow listed only"))
		mp:value("allow", translate("Allow all except listed"))
		ml = s:taboption("macfilter", DynamicList, "maclist", translate("MAC-List"))
		ml:depends({macpolicy="allow"})
		ml:depends({macpolicy="deny"})

		s:taboption("advanced", Value, "rate", translate("Transmission Rate"))
		s:taboption("advanced", Value, "frag", translate("Fragmentation Threshold"))
		s:taboption("advanced", Value, "rts", translate("RTS/CTS Threshold"))
	end


	------------------- WiFI-Encryption -------------------

	encr = s:taboption("encryption", ListValue, "encryption", translate("Encryption"))
	encr.override_values = true
	encr.override_depends = true
	encr:depends({mode="ap"})
	encr:depends({mode="sta"})
	encr:depends({mode="adhoc"})
	encr:depends({mode="ahdemo"})
	encr:depends({mode="ap-wds"})
	encr:depends({mode="sta-wds"})
	encr:depends({mode="mesh"})

	encr:value("none", "No Encryption")
	encr:value("wep", "WEP", {mode="ap"}, {mode="sta"}, {mode="ap-wds"}, {mode="sta-wds"})

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
			encr.description = translate(
				"WPA-Encryption requires wpa_supplicant (for client mode) or hostapd (for AP " ..
				"and ad-hoc mode) to be installed."
			)
		elseif not hostapd and supplicant then
			encr:value("psk", "WPA-PSK", {mode="sta"}, {mode="sta-wds"})
			encr:value("psk2", "WPA2-PSK", {mode="sta"}, {mode="sta-wds"})
			encr:value("psk-mixed", "WPA-PSK/WPA2-PSK Mixed Mode", {mode="sta"}, {mode="sta-wds"})
			encr:value("wpa", "WPA-EAP", {mode="sta"}, {mode="sta-wds"})
			encr:value("wpa2", "WPA2-EAP", {mode="sta"}, {mode="sta-wds"})
			encr.description = translate(
				"WPA-Encryption requires wpa_supplicant (for client mode) or hostapd (for AP " ..
				"and ad-hoc mode) to be installed."
			)
		else
			encr.description = translate(
				"WPA-Encryption requires wpa_supplicant (for client mode) or hostapd (for AP " ..
				"and ad-hoc mode) to be installed."
			)
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

	server = s:taboption("encryption", Value, "server", translate("Radius-Server"))
	server:depends({mode="ap", encryption="wpa"})
	server:depends({mode="ap", encryption="wpa2"})
	server:depends({mode="ap-wds", encryption="wpa"})
	server:depends({mode="ap-wds", encryption="wpa2"})
	server.rmempty = true

	port = s:taboption("encryption", Value, "port", translate("Radius-Port"))
	port:depends({mode="ap", encryption="wpa"})
	port:depends({mode="ap", encryption="wpa2"})
	port:depends({mode="ap-wds", encryption="wpa"})
	port:depends({mode="ap-wds", encryption="wpa2"})
	port.rmempty = true

	key = s:taboption("encryption", Value, "key", translate("Key"))
	key:depends("encryption", "wep")
	key:depends("encryption", "psk")
	key:depends("encryption", "psk2")
	key:depends("encryption", "psk+psk2")
	key:depends("encryption", "psk-mixed")
	key:depends({mode="ap", encryption="wpa"})
	key:depends({mode="ap", encryption="wpa2"})
	key:depends({mode="ap-wds", encryption="wpa"})
	key:depends({mode="ap-wds", encryption="wpa2"})
	key.rmempty = true
	key.password = true

	if hwtype == "atheros" or hwtype == "mac80211" or hwtype == "prism2" then
		nasid = s:taboption("encryption", Value, "nasid", translate("NAS ID"))
		nasid:depends({mode="ap", encryption="wpa"})
		nasid:depends({mode="ap", encryption="wpa2"})
		nasid:depends({mode="ap-wds", encryption="wpa"})
		nasid:depends({mode="ap-wds", encryption="wpa2"})
		nasid.rmempty = true

		eaptype = s:taboption("encryption", ListValue, "eap_type", translate("EAP-Method"))
		eaptype:value("TLS")
		eaptype:value("TTLS")
		eaptype:value("PEAP")
		eaptype:depends({mode="sta", encryption="wpa"})
		eaptype:depends({mode="sta", encryption="wpa2"})

		cacert = s:taboption("encryption", FileUpload, "ca_cert", translate("Path to CA-Certificate"))
		cacert:depends({mode="sta", encryption="wpa"})
		cacert:depends({mode="sta", encryption="wpa2"})

		privkey = s:taboption("encryption", FileUpload, "priv_key", translate("Path to Private Key"))
		privkey:depends({mode="sta", eap_type="TLS", encryption="wpa2"})
		privkey:depends({mode="sta", eap_type="TLS", encryption="wpa"})

		privkeypwd = s:taboption("encryption", Value, "priv_key_pwd", translate("Password of Private Key"))
		privkeypwd:depends({mode="sta", eap_type="TLS", encryption="wpa2"})
		privkeypwd:depends({mode="sta", eap_type="TLS", encryption="wpa"})


		auth = s:taboption("encryption", Value, "auth", translate("Authentication"))
		auth:value("PAP")
		auth:value("CHAP")
		auth:value("MSCHAP")
		auth:value("MSCHAPV2")
		auth:depends({mode="sta", eap_type="PEAP", encryption="wpa2"})
		auth:depends({mode="sta", eap_type="PEAP", encryption="wpa"})
		auth:depends({mode="sta", eap_type="TTLS", encryption="wpa2"})
		auth:depends({mode="sta", eap_type="TTLS", encryption="wpa"})


		identity = s:taboption("encryption", Value, "identity", translate("Identity"))
		identity:depends({mode="sta", eap_type="PEAP", encryption="wpa2"})
		identity:depends({mode="sta", eap_type="PEAP", encryption="wpa"})
		identity:depends({mode="sta", eap_type="TTLS", encryption="wpa2"})
		identity:depends({mode="sta", eap_type="TTLS", encryption="wpa"})

		password = s:taboption("encryption", Value, "password", translate("Password"))
		password:depends({mode="sta", eap_type="PEAP", encryption="wpa2"})
		password:depends({mode="sta", eap_type="PEAP", encryption="wpa"})
		password:depends({mode="sta", eap_type="TTLS", encryption="wpa2"})
		password:depends({mode="sta", eap_type="TTLS", encryption="wpa"})
	end
end

return m
