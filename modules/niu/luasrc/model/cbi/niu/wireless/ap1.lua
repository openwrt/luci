--[[
LuCI - Lua Configuration Interface

Copyright 2009 Steven Barth <steven@midlink.org>
Copyright 2009 Jo-Philipp Wich <xm@subsignal.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--

local iface = "ap"
local ap = true

local fs = require "nixio.fs"
local sys = require "luci.sys"
local cursor = require "luci.model.uci".inst
local state = require "luci.model.uci".inst_state
cursor:unload("wireless")


local device = cursor:get("wireless", iface, "device")
local hwtype = cursor:get("wireless", device, "type")

local nsantenna = cursor:get("wireless", device, "antenna")

local iw = nil
local tx_powers = {}
local chan = {}

state:foreach("wireless", "wifi-iface",
	function(s)
		if s.device == device and not iw then
			iw = sys.wifi.getiwinfo(s.ifname or s.device)
			chan = iw and iw.freqlist or { }
			tx_powers = iw.txpwrlist or { }
		end
	end)
	
local m


if ap then
m = Map("wireless", translate("Configure Access Point"))
end

--- Device Settings ---
s = m:section(NamedSection, device, "wifi-device", "Device Configuration")
s.addremove = false

s:tab("general", translate("General Settings"))

ch = s:taboption("general", Value, "channel", translate("Channel"))
ch:value("auto", translate("automatic"))
for _, f in ipairs(chan) do
	ch:value(f.channel, "%i (%.3f GHz)" %{ f.channel, f.mhz / 1000 })
end



s:tab("expert", translate("Expert Settings"))
if hwtype == "mac80211" then
	local macaddr = cursor:get("wireless", device, "macaddr") or "!"
	local hwmode = cursor:get("wireless", device, "hwmode")
	local modes = {}
	local phy
	local allowed = {}
	for entry in fs.glob("/sys/class/ieee80211/*") do
		if (fs.readfile(entry .. "/macaddress") or ""):find(macaddr) == 1 then
			phy = entry:sub(22)
		end
	end
	if phy then
		local iwp = io.popen("iw phy " .. phy .. " info")
		local iwin = iwp:read("*a")
		
		if iwp then
			iwp:close()
			local htcap = iwin:match("HT capabilities:%s*0x([0-9a-fA-F]+)")
			allowed.n = (htcap and tonumber(htcap, 16) or 0) > 0
			allowed.g = iwin:find("2412 MHz")
			allowed.a = iwin:find("5180 MHz")
		end
	end
	
	if next(allowed) then
		mode = s:taboption("expert", ListValue, "hwmode", translate("Communication Protocol"))
		if allowed.n and allowed.g then
			mode:value("11ng", "802.11n (2.4 GHz)")
		end
		if allowed.n and allowed.a then
			mode:value("11na", "802.11n (5 GHz)")
		end
		if allowed.a then
			mode:value("11a", "802.11a (5 GHz)")
		end
		if allowed.g then
			mode:value("11g", "802.11g (2.4 GHz)")
			mode:value("11bg", "802.11b+g (2.4 GHz)")
			mode:value("11b", "802.11b (2.4 GHz)")
		end
	end

	tp = s:taboption("expert",
		(tx_powers and #tx_powers > 0) and ListValue or Value,
		"txpower", translate("Transmission Power"), "dBm")

	tp.rmempty = true
	tp:value("", translate("automatic"))
	for _, p in ipairs(iw and iw.txpwrlist or {}) do
		tp:value(p.dbm, "%i dBm (%i mW)" %{ p.dbm, p.mw })
	end
elseif hwtype == "atheros" then
	tp = s:taboption("expert",
		(#tx_powers > 0) and ListValue or Value,
		"txpower", translate("Transmission Power"), "dBm")

	tp.rmempty = true
	tp:value("", translate("automatic"))
	for _, p in ipairs(iw.txpwrlist) do
		tp:value(p.dbm, "%i dBm (%i mW)" %{ p.dbm, p.mw })
	end

	mode = s:taboption("expert", ListValue, "hwmode", translate("Communication Protocol"))
	mode:value("", translate("automatic"))
	mode:value("11g", "802.11g")
	mode:value("11b", "802.11b")
	mode:value("11bg", "802.11b+g")
	mode:value("11a", "802.11a")
	mode:value("11gst", "802.11g + Turbo")
	mode:value("11ast", "802.11a + Turbo")
	
	if nsantenna then -- NanoFoo
		local ant = s:taboption("expert", ListValue, "antenna", translate("Transmitter Antenna"))
		ant:value("auto")
		ant:value("vertical")
		ant:value("horizontal")
		ant:value("external")
		ant.default = "auto"
	end
elseif hwtype == "broadcom" then
	tp = s:taboption("expert",
		(#tx_powers > 0) and ListValue or Value,
		"txpower", translate("Transmit Power"), "dBm")

	tp.rmempty = true
	tp:value("", translate("automatic"))
	for _, p in ipairs(iw.txpwrlist) do
		tp:value(p.dbm, "%i dBm (%i mW)" %{ p.dbm, p.mw })
	end	

	mp = s:taboption("expert", ListValue, "macfilter", translate("MAC-Address Filter"))
	mp:value("", translate("disable"))
	mp:value("allow", translate("Allow listed only"))
	mp:value("deny", translate("Allow all except listed"))
	ml = s:taboption("expert", DynamicList, "maclist", translate("MAC-List"))
	ml:depends({macfilter="allow"})
	ml:depends({macfilter="deny"})

	s:taboption("expert", Flag, "frameburst", translate("Allow Burst Transmissions"))
elseif hwtype == "prism2" then
	s:taboption("expert", Value, "txpower", translate("Transmission Power"), "att units").rmempty = true
end




s = m:section(NamedSection, iface, "wifi-iface", translate("Interface Details"))
s.addremove = false

s:tab("general", translate("General Settings"))
s:tab("expert", translate("Expert Settings"))



local ssid = s:taboption("general", Value, "ssid", translate("Network Name (<abbr title=\"Extended Service Set Identifier\">ESSID</abbr>)"))

mode = s:taboption("expert", ListValue, "mode", translate("Operating Mode"))
mode.override_values = true
mode:value("ap", translate("Access Point"))

encr = s:taboption("expert", ListValue, "encryption", translate("Encryption"))


if hwtype == "mac80211" then
	mode:value("mesh", translate("Mesh (802.11s)"))
	local meshid = s:taboption("expert", Value, "mesh_id", translate("Mesh ID"))
	meshid:depends("mode", "mesh")

	s:taboption("expert", Flag, "wds", translate("Enable Bridging and Repeating (WDS)")):depends("mode", "ap")
	s:taboption("expert", Flag, "powersave", translate("Enable Powersaving")):depends("mode", "ap")
elseif hwtype == "atheros" then
	-- mode:value("wds", translate("Static WDS"))
	
	mp = s:taboption("expert", ListValue, "macpolicy", translate("MAC-Address Filter"))
	mp:value("", translate("disable"))
	mp:value("deny", translate("Allow listed only"))
	mp:value("allow", translate("Allow all except listed"))
	ml = s:taboption("expert", DynamicList, "maclist", translate("MAC-List"))
	ml:depends({macpolicy="allow"})
	ml:depends({macpolicy="deny"})

	s:taboption("expert", Flag, "wds", translate("Enable Bridging and Repeating (WDS)"))
		
	if ap then				
		hidden = s:taboption("expert", Flag, "hidden", translate("Hide Access Point"))
		hidden:depends({mode="ap"})
		hidden:depends({mode="ap-wds"})
		
		isolate = s:taboption("expert", Flag, "isolate", translate("Prevent communication between clients"))
		isolate:depends({mode="ap"})
	end
	
	s:taboption("expert", Flag, "bursting", translate("Allow Burst Transmissions"))
elseif hwtype == "broadcom" then
	if ap then
		hidden = s:taboption("expert", Flag, "hidden", translate("Hide Access Point"))
		hidden:depends({mode="ap"})
		hidden:depends({mode="wds"})
	
		isolate = s:taboption("expert", Flag, "isolate", translate("Prevent communication between clients"))
		isolate:depends({mode="ap"})
	end
elseif hwtype == "prism2" then
	mp = s:taboption("expert", ListValue, "macpolicy", translate("MAC-Address Filter"))
	mp:value("", translate("disable"))
	mp:value("deny", translate("Allow listed only"))
	mp:value("allow", translate("Allow all except listed"))
	
	ml = s:taboption("expert", DynamicList, "maclist", translate("MAC-List"))
	ml:depends({macpolicy="allow"})
	ml:depends({macpolicy="deny"})
	
	if ap then
		hidden = s:taboption("expert", Flag, "hidden", translate("Hide Access Point"))
		hidden:depends({mode="ap"})
		hidden:depends({mode="wds"})
	end
end

-- Encryption --

encr.default = "wep" -- Early default
encr.override_values = true
encr.override_depends = true
encr:value("none", "No Encryption")
encr:value("wep", "WEP", {mode="ap"})

if hwtype == "atheros" or hwtype == "mac80211" or hwtype == "prism2" then
	local hostapd = fs.access("/usr/sbin/hostapd") or os.getenv("LUCI_SYSROOT")
	local supplicant = fs.access("/usr/sbin/wpa_supplicant") or os.getenv("LUCI_SYSROOT")

	if hostapd and not supplicant then		
		encr:value("psk", "WPA", {mode="ap"})
		encr:value("wpa", "WPA-EAP", {mode="ap"})
		encr:value("psk-mixed", "WPA + WPA2", {mode="ap"})
		encr:value("psk2", "WPA2", {mode="ap"})
		encr:value("wpa2", "WPA2-EAP (802.11i)", {mode="ap"})
		encr.default = "psk-mixed"
	elseif not hostapd and supplicant then
		encr:value("psk", "WPA", {mode="mesh"})
		encr:value("psk2", "WPA2", {mode="mesh"})
		encr.default = "psk2"
	elseif hostapd and supplicant then
		encr:value("psk", "WPA", {mode="ap"}, {mode="mesh"})
		encr:value("wpa", "WPA-EAP", {mode="ap"})
		encr:value("psk-mixed", "WPA + WPA2", {mode="ap"})
		encr:value("psk2", "WPA2", {mode="ap"}, {mode="mesh"})
		encr:value("wpa2", "WPA2-EAP (802.11i)", {mode="ap"})
		encr.default = "psk-mixed"		
	end
elseif hwtype == "broadcom" then
	encr:value("psk", "WPA")
	encr:value("psk+psk2", "WPA + WPA2")
	encr:value("psk2", "WPA2")
	encr.default = "psk+psk2"
end

server = s:taboption("general", Value, "server", translate("Radius-Server"))
server:depends({mode="ap", encryption="wpa"})
server:depends({mode="ap", encryption="wpa2"})
server.rmempty = true

port = s:taboption("general", Value, "port", translate("Radius-Port"))
port:depends({mode="ap", encryption="wpa"})
port:depends({mode="ap", encryption="wpa2"})
port.rmempty = true

key = s:taboption("general", Value, "key", translate("Password"))
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
	nasid = s:taboption("general", Value, "nasid", translate("NAS ID"))
	nasid:depends({mode="ap", encryption="wpa"})
	nasid:depends({mode="ap", encryption="wpa2"})
	nasid.rmempty = true
end
return m
