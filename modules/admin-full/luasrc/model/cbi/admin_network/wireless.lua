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
require("luci.sys")
require("luci.tools.webadmin")

local wireless = luci.model.uci.cursor_state():get_all("wireless")
local wifidata = luci.sys.wifi.getiwconfig()
local ifaces = {}

for k, v in pairs(wireless) do
	if v[".type"] == "wifi-iface" then
		table.insert(ifaces, v)
	end
end


m = SimpleForm("wireless", translate("Wifi"))

s = m:section(Table, ifaces, translate("Networks"))

function s.extedit(self, section) 
	local device = self.map:get(section, "device") or ""
	return  luci.dispatcher.build_url(unpack(luci.dispatcher.context.requested.path)) .. "/" .. device
end

link = s:option(DummyValue, "_link", translate("Link"))
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

channel = s:option(DummyValue, "channel", translate("Channel"))
function channel.cfgvalue(self, section)
	return wireless[self.map:get(section, "device")].channel
end

protocol = s:option(DummyValue, "_mode", translate("Protocol"))
function protocol.cfgvalue(self, section)
	local mode = wireless[self.map:get(section, "device")].mode
	return mode and "802." .. mode
end

mode = s:option(DummyValue, "mode", translate("Mode"))
encryption = s:option(DummyValue, "encryption", translate("<abbr title=\"Encrypted\">Encr.</abbr>"))

power = s:option(DummyValue, "_power", translate("Power"))
function power.cfgvalue(self, section)
	local ifname = self.map:get(section, "ifname")
	return wifidata[ifname] and wifidata[ifname]["Tx-Power"] or "-"
end

scan = s:option(Button, "_scan", translate("Scan"))
scan.inputstyle = "find"

function scan.cfgvalue(self, section)
	return self.map:get(section, "ifname") or false
end

t2 = m:section(Table, {}, translate("<abbr title=\"Wireless Local Area Network\">WLAN</abbr>-Scan"), translate("Wifi networks in your local environment"))

function scan.write(self, section)
	t2.render = t2._render
	local ifname = self.map:get(section, "ifname")
	luci.util.update(t2.data, luci.sys.wifi.iwscan(ifname))
end

t2._render = t2.render
t2.render = function() end

t2:option(DummyValue, "Quality", translate("Link"))
essid = t2:option(DummyValue, "ESSID", "ESSID")
function essid.cfgvalue(self, section)
	return luci.util.pcdata(self.map:get(section, "ESSID"))
end

t2:option(DummyValue, "Address", "BSSID")
t2:option(DummyValue, "Mode", translate("Mode"))
chan = t2:option(DummyValue, "channel", translate("Channel"))
function chan.cfgvalue(self, section)
	return self.map:get(section, "Channel")
	    or self.map:get(section, "Frequency")
	    or "-"
end 

t2:option(DummyValue, "Encryption key", translate("<abbr title=\"Encrypted\">Encr.</abbr>"))

t2:option(DummyValue, "Signal level", translate("Signal"))

t2:option(DummyValue, "Noise level", translate("Noise"))


s2 = m:section(SimpleSection, translate("Create Network"))
create = s2:option(ListValue, "create", translate("Device"))
create:value("", translate("-- Please choose --"))
for k, v in pairs(wireless) do
	if v[".type"] == "wifi-device" then
		create:value(k)
	end
end

function create.write(self, section, value)
	local uci = luci.model.uci.cursor()
	uci:load("wireless")
	uci:section("wireless", "wifi-iface", nil, {device=value})
	uci:save("wireless")
	luci.http.redirect(luci.dispatcher.build_url(unpack(luci.dispatcher.context.requested.path)) .. "/" .. value)
end

function create.cbid(self, section)
	return "priv.cbid.create"
end

return m
