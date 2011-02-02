--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0
]]

local fs = require "luci.fs"
local util = require "luci.util"
local uci = require "luci.model.uci".cursor()
local profiles = "/etc/config/profile_"

m = Map("freifunk", translate ("Community"))
c = m:section(NamedSection, "community", "public", nil, translate([[These are the basic
settings for your local wireless community. These settings define the default values for the wizard
and DO NOT affect the actual configuration of the router.]]))

community = c:option(ListValue, "name", translate ("Community"))
community.rmempty = false

local list = { }
local list = fs.glob(profiles .. "*")

for k,v in ipairs(list) do
	local name = uci:get_first(v, "community", "name") or "?"
	local n = string.gsub(v, profiles, "")
	community:value(n, name)
end

n = Map("system", translate("Basic system settings"))
b = n:section(TypedSection, "system")
b.anonymous = true

hn = b:option(Value, "hostname", translate("Hostname"))
hn.rmempty = false
function hn.validate(self, value)
	if value == nil then
		return
	elseif (#value > 24) or string.match(value, "[^%w%.%-]") or string.match(value, "^[%-%.]") or string.match(value, "[%-%.]$") then
		return nil, translate("Hostname may contain up to 24 alphanumeric characters. Minus and period are also allowed, but not in the beginning or the end of the hostname.")
	else
		return value
	end
end

loc = b:option(Value, "location", translate("Location"))
loc.rmempty = false

lat = b:option(Value, "latitude", translate("Latitude"), translate("e.g.") .. " 48.12345")
lat.rmempty = false

lon = b:option(Value, "longitude", translate("Longitude"), translate("e.g.") .. " 10.12345")
lon.rmempty = false

--[[
Opens an OpenStreetMap iframe or popup
Makes use of resources/OSMLatLon.htm and htdocs/resources/osm.js
(is that the right place for files like these?)
]]--

--[[ this needs to be fixed
local class = util.class
local co = "profile_augsburg"
local syslat = uci:get_first(co, "community", "latitude")
local syslon = uci:get_first(co, "community", "longitude")

OpenStreetMapLonLat = class(AbstractValue)

function OpenStreetMapLonLat.__init__(self, ...)
	AbstractValue.__init__(self, ...)
	self.template = "cbi/osmll_value"
	self.latfield = nil
	self.lonfield = nil
	self.centerlat = ""
	self.centerlon = ""
	self.zoom = "0"
	self.width = "100%" --popups will ignore the %-symbol, "100%" is interpreted as "100"
	self.height = "600"
	self.popup = false
	self.displaytext="OpenStreetMap" --text on button, that loads and displays the OSMap
	self.hidetext="X" -- text on button, that hides OSMap
end


f = SimpleForm("ffwizward", "OpenStreetMap", "Hier kann man die Geokoordinaten des Knotens herausfinden.")

osm = f:field(OpenStreetMapLonLat, "latlon", "Geokoordinaten mit OpenStreetMap ermitteln:", "Klicken Sie auf Ihren Standort in der Karte. Diese Karte funktioniert nur, wenn das Gerät bereits eine Verbindung zum Internet hat.")
osm.latfield = "lat"
osm.lonfield = "lon"
osm.centerlat = syslat
osm.centerlon = syslon
osm.width = "100%"
osm.height = "600"
osm.popup = false

syslatlengh = string.len(syslat)
if syslatlengh > 7 then
	osm.zoom = "15"
elseif syslatlengh > 5 then
	osm.zoom = "12"
else
	osm.zoom = "6"
end

osm.displaytext="OpenStreetMap anzeigen"
osm.hidetext="OpenStreetMap verbergen"
]]

return m, n
