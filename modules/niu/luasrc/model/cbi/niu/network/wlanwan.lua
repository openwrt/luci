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

local fs = require "nixio.fs"
local uci = require "luci.model.uci"
local nixio = require "nixio"
local iwinfo = require "iwinfo"

local bridge
local iface = "client"
local net = "wan"
if arg[1] == "bridge" then
	bridge = true
	iface = "bridge"
	net = "lan"
end

local cursor = uci.inst
local state = uci.inst_state
cursor:unload("wireless")
state:unload("wireless")

local has_ipv6 = fs.access("/proc/net/ipv6_route")
local device = cursor:get("wireless", iface, "device")
local hwtype = cursor:get("wireless", device, "type")


-- Bring up interface and scan --

if not state:get("wireless", iface, "network") then
	local olduci = uci.cursor(nil, "")
	local oldcl = olduci:get_all("wireless", iface)
	olduci:unload("wireless")
	
	local newuci = uci.cursor()
	local newcl = newuci:get_all("wireless", iface)
	newcl.network = net
	
	local proc = nixio.fork()
	if proc == 0 then
		newuci:delete("wireless", iface, "ssid")
		newuci:commit("wireless")
		nixio.exec("/sbin/wifi", "up", device)
		os.exit(1) 
	end
	nixio.wait(proc)
	
	newuci:delete("wireless", iface)
	newuci:section("wireless", "wifi-iface", iface, oldcl)
	newuci:commit("wireless")
	newuci:tset("wireless", iface, newcl)
	newuci:save("wireless")
	newuci:unload("wireless")

	state:unload("wireless")
end
 
local ifname = state:get("wireless", iface, "ifname") or "wlan0dummy"
local iwlib = iwinfo.type(ifname) and iwinfo[iwinfo.type(ifname)]
local suggest = {}
local encrdep = {
	none = {{["!default"] = 1}},
	wep = {{["!default"] = 1}},
	psk = {{["!default"] = 1}},
	psk2 = {{["!default"] = 1}},
	wpa = {{["!default"] = 1}},
	wpa2 = {{["!default"] = 1}}
}

if iwlib then
	suggest = iwlib.scanlist(ifname)
end



-- Form definition --

m2 = Map("wireless", translate("Configure WLAN-Adapter for Client Connection"),
bridge and ("<strong>" .. translate([[It is absolutely necessary that the network you are joining
supports and allows bridging (WDS) otherwise your connection will fail.]]) .. "</strong> " .. 
translate([[Note: You can use the access point wizard to configure your
private access point to increase the range of the network you are connected to.]])) or "")

s = m2:section(NamedSection, iface, "wifi-iface", translate("Wireless Settings"))
s.addremove = false

s:tab("general", translate("General Settings"))
s:tab("expert", translate("Expert Settings"))

local ssid = s:taboption("general", Value, "ssid", translate("Network Name (<abbr title=\"Extended Service Set Identifier\">ESSID</abbr>)"))
ssid.rmempty = false

for _, v in ipairs(suggest) do
	if v.mode == "Master" then
		ssid:value(v.ssid)
		
		if not v.wep then
			encrdep.wep[#encrdep.wep+1] = {ssid = v.ssid, ["!reverse"] = 1}
		end
		if v.wpa ~= 1 or (v.wpa == 1 and v.auth_suites[1] ~= "802.1x") then
			encrdep.wpa[#encrdep.wpa+1] = {ssid = v.ssid, ["!reverse"] = 1}
		end
		if v.wpa ~= 1 or (v.wpa == 1 and v.auth_suites[1] ~= "PSK") then		
			encrdep.psk[#encrdep.psk+1] = {ssid = v.ssid, ["!reverse"] = 1}
		end
		if not v.wpa or v.wpa < 2 or (v.wpa >= 2 and v.auth_suites[1] ~= "802.1x") then
			encrdep.wpa2[#encrdep.wpa2+1] = {ssid = v.ssid, ["!reverse"] = 1}
		end
		if not v.wpa or v.wpa < 2 or (v.wpa >= 2 and v.auth_suites[1] ~= "PSK") then
			encrdep.psk2[#encrdep.psk2+1] = {ssid = v.ssid, ["!reverse"] = 1}
		end
		if v.wpa or v.wep then
			encrdep.none[#encrdep.none+1] = {ssid = v.ssid, ["!reverse"] = 1} 
		end
	end
end

mode = s:taboption("expert", ListValue, "mode", translate("Operating Mode"))
mode.override_values = true
mode:value("sta", translate("Client"))

encr = s:taboption("general", ListValue, "encryption", translate("Encryption"))


if hwtype == "mac80211" then
	if not bridge then
		mode:value("mesh", translate("Mesh (802.11s)"))
		local meshid = s:taboption("expert", Value, "mesh_id", translate("Mesh ID"))
		meshid:depends("mode", "mesh")
	end
	
	local ps = s:taboption("expert", Flag, "powersave", translate("Enable Powersaving"))
	ps:depends("mode", "sta")
elseif hwtype == "atheros" then
	s:taboption("expert", Flag, "bursting", translate("Allow Burst Transmissions"))
end



-- Encryption --

encr.override_values = true
encr.override_depends = true
encr:value("none", "No Encryption", unpack(encrdep.none))
encr:value("wep", "WEP", unpack(encrdep.wep))

if hwtype == "atheros" or hwtype == "mac80211" or hwtype == "prism2" then
	local supplicant = fs.access("/usr/sbin/wpa_supplicant") or os.getenv("LUCI_SYSROOT")
	if supplicant then		
		encr:value("psk", "WPA", unpack(encrdep.psk))
		encr:value("wpa", "WPA-EAP", unpack(encrdep.wpa))
		encr:value("psk2", "WPA2", unpack(encrdep.psk2))
		encr:value("wpa2", "WPA2-EAP (802.11i)", unpack(encrdep.wpa2))
	end
elseif hwtype == "broadcom" then
	encr:value("psk", "WPA", unpack(encrdep.psk))
	encr:value("psk2", "WPA2", unpack(encrdep.psk2))
end

key = s:taboption("general", Value, "key", translate("Password"))
key:depends("encryption", "wep")
key:depends("encryption", "psk")
key:depends("encryption", "psk2")
key.rmempty = true
key.password = true

if hwtype == "atheros" or hwtype == "mac80211" or hwtype == "prism2" then
	eaptype = s:taboption("general", ListValue, "eap_type", translate("EAP-Method"))
	eaptype:value("TLS")
	eaptype:value("TTLS")
	eaptype:value("PEAP")
	eaptype:depends({encryption="wpa"})
	eaptype:depends({encryption="wpa2"})

	cacert = s:taboption("general", FileUpload, "ca_cert", translate("Path to CA-Certificate"))
	cacert:depends({encryption="wpa"})
	cacert:depends({encryption="wpa2"})

	privkey = s:taboption("general", FileUpload, "priv_key", translate("Path to Private Key"))
	privkey:depends({eap_type="TLS", encryption="wpa2"})
	privkey:depends({eap_type="TLS", encryption="wpa"})

	privkeypwd = s:taboption("general", Value, "priv_key_pwd", translate("Password of Private Key"))
	privkeypwd:depends({eap_type="TLS", encryption="wpa2"})
	privkeypwd:depends({eap_type="TLS", encryption="wpa"})


	auth = s:taboption("general", Value, "auth", translate("Authentication"))
	auth:value("PAP")
	auth:value("CHAP")
	auth:value("MSCHAP")
	auth:value("MSCHAPV2")
	auth:depends({eap_type="PEAP", encryption="wpa2"})
	auth:depends({eap_type="PEAP", encryption="wpa"})
	auth:depends({eap_type="TTLS", encryption="wpa2"})
	auth:depends({eap_type="TTLS", encryption="wpa"})


	identity = s:taboption("general", Value, "identity", translate("Identity"))
	identity:depends({eap_type="PEAP", encryption="wpa2"})
	identity:depends({eap_type="PEAP", encryption="wpa"})
	identity:depends({eap_type="TTLS", encryption="wpa2"})
	identity:depends({eap_type="TTLS", encryption="wpa"})

	password = s:taboption("general", Value, "password", translate("Password"))
	password:depends({eap_type="PEAP", encryption="wpa2"})
	password:depends({eap_type="PEAP", encryption="wpa"})
	password:depends({eap_type="TTLS", encryption="wpa2"})
	password:depends({eap_type="TTLS", encryption="wpa"})
end



if not bridge then

m = Map("network")

s = m:section(NamedSection, net, "interface", translate("Address Settings"))
s.addremove = false

s:tab("general", translate("General Settings"))
s:tab("expert", translate("Expert Settings"))

p = s:taboption("general", ListValue, "proto", "Connection Type")
p.override_scheme = true
p.default = "dhcp"
p:value("dhcp", "Automatic Configuration (DHCP)")
p:value("static", "Static Configuration")



ipaddr = s:taboption("general", Value, "ipaddr", translate("<abbr title=\"Internet Protocol Version 4\">IPv4</abbr>-Address"))
ipaddr.rmempty = true
ipaddr:depends("proto", "static")

nm = s:taboption("general", Value, "netmask", translate("<abbr title=\"Internet Protocol Version 4\">IPv4</abbr>-Netmask"))
nm.rmempty = true
nm:depends("proto", "static")
nm:value("255.255.255.0")
nm:value("255.255.0.0")
nm:value("255.0.0.0")

gw = s:taboption("general", Value, "gateway", translate("<abbr title=\"Internet Protocol Version 4\">IPv4</abbr>-Gateway"))
gw:depends("proto", "static")
gw.rmempty = true

bcast = s:taboption("expert", Value, "bcast", translate("<abbr title=\"Internet Protocol Version 4\">IPv4</abbr>-Broadcast"))
bcast:depends("proto", "static")

if has_ipv6 then
	ip6addr = s:taboption("expert", Value, "ip6addr", translate("<abbr title=\"Internet Protocol Version 6\">IPv6</abbr>-Address"), translate("<abbr title=\"Classless Inter-Domain Routing\">CIDR</abbr>-Notation: address/prefix"))
	ip6addr:depends("proto", "static")

	ip6gw = s:taboption("expert", Value, "ip6gw", translate("<abbr title=\"Internet Protocol Version 6\">IPv6</abbr>-Gateway"))
	ip6gw:depends("proto", "static")
end

dns = s:taboption("expert", Value, "dns", translate("<abbr title=\"Domain Name System\">DNS</abbr>-Server"))
dns:depends("peerdns", "")

mtu = s:taboption("expert", Value, "mtu", "MTU")
mtu.isinteger = true

mac = s:taboption("expert", Value, "macaddr", translate("<abbr title=\"Media Access Control\">MAC</abbr>-Address"))

return m2, m

else

return m2

end