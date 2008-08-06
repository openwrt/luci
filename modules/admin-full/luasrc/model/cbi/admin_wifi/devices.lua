--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--
m = Map("wireless", translate("devices"), translate("a_w_devices1", 
	"An dieser Stelle können eingebaute WLAN-Geräte konfiguriert werden."))

s = m:section(TypedSection, "wifi-device", "")
--s.addremove = true

en = s:option(Flag, "disabled", translate("enable"))
en.enabled = "0"
en.disabled = "1"

function en.cfgvalue(self, section)
	return Flag.cfgvalue(self, section) or "0"
end

t = s:option(ListValue, "type", translate("type"))
t:value("broadcom")
t:value("atheros")
t:value("mac80211")
t:value("prism2")
--[[
require("luci.sys")
local c = ". /etc/functions.sh;for i in /lib/wifi/*;do . $i;done;echo $DRIVERS"
for driver in luci.util.execl(c)[1]:gmatch("[^ ]+") do
	t:value(driver)
end
]]--

mode = s:option(ListValue, "mode", translate("mode"))
mode:value("", "standard")
mode:value("11b", "802.11b")
mode:value("11g", "802.11g")
mode:value("11a", "802.11a")
mode:value("11bg", "802.11b+g")
mode.rmempty = true

s:option(Value, "channel", translate("a_w_channel"))

s:option(Value, "txantenna", translate("a_w_txantenna")).rmempty = true

s:option(Value, "rxantenna", translate("a_w_rxantenna")).rmempty = true

s:option(Value, "distance", translate("distance"),
	translate("a_w_distance1")).rmempty = true

s:option(Value, "diversity", translate("a_w_diversity")):depends("type", "atheros")
	
country = s:option(Value, "country", translate("a_w_countrycode"))
country.optional = true
country:depends("type", "broadcom")

maxassoc = s:option(Value, "maxassoc", translate("a_w_connlimit"))
maxassoc:depends("type", "broadcom")
maxassoc.optional = true

return m