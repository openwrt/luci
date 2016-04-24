-- Copyright 2008 Steven Barth <steven@midlink.org>
-- Copyright 2011 Manuel Munz <freifunk at somakoma de>
-- Licensed to the public under the Apache License 2.0.

local fs = require "nixio.fs"
local util = require "luci.util"
local uci = require "luci.model.uci".cursor()
local profiles = "/etc/config/profile_*"

m = Map("freifunk", translate ("Community"))
c = m:section(NamedSection, "community", "public", nil, translate("These are the basic settings for your local wireless community. These settings define the default values for the wizard and DO NOT affect the actual configuration of the router."))

community = c:option(ListValue, "name", translate ("Community"))
community.rmempty = false

local profile
for profile in fs.glob(profiles) do
	local name = uci:get_first(profile, "community", "name") or "?"
	community:value(string.gsub(profile, "/etc/config/profile_", ""), name)
end


n = Map("system", translate("Basic system settings"))
function n.on_after_commit(self)
	luci.http.redirect(luci.dispatcher.build_url("admin", "freifunk", "basics"))
end

b = n:section(TypedSection, "system")
b.anonymous = true

hn = b:option(Value, "hostname", translate("Hostname"))
hn.rmempty = false
hn.datatype = "hostname"

loc = b:option(Value, "location", translate("Location"))
loc.rmempty = false
loc.datatype = "minlength(1)"

lat = b:option(Value, "latitude", translate("Latitude"), translate("e.g.") .. " 48.12345")
lat.datatype = "float"
lat.rmempty = false

lon = b:option(Value, "longitude", translate("Longitude"), translate("e.g.") .. " 10.12345")
lon.datatype = "float"
lon.rmempty = false

--[[
Opens an OpenStreetMap iframe or popup
Makes use of resources/OSMLatLon.htm and htdocs/resources/osm.js
]]--

local class = util.class
local ff = uci:get("freifunk", "community", "name") or ""
local co = "profile_" .. ff

local deflat = uci:get_first("system", "system", "latitude") or uci:get_first(co, "community", "latitude") or 52
local deflon = uci:get_first("system", "system", "longitude") or uci:get_first(co, "community", "longitude") or 10
local zoom = 12
if ( deflat == 52 and deflon == 10 ) then
	zoom = 4
end

OpenStreetMapLonLat = luci.util.class(AbstractValue)
    
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

	osm = b:option(OpenStreetMapLonLat, "latlon", translate("Find your coordinates with OpenStreetMap"), translate("Select your location with a mouse click on the map. The map will only show up if you are connected to the Internet."))
	osm.latfield = "latitude"
	osm.lonfield = "longitude"
	osm.centerlat = uci:get_first("system", "system", "latitude") or deflat
	osm.centerlon = uci:get_first("system", "system", "longitude") or deflon
	osm.zoom = zoom
	osm.width = "100%"
	osm.height = "600"
	osm.popup = false
	osm.displaytext=translate("Show OpenStreetMap")
	osm.hidetext=translate("Hide OpenStreetMap")

return m, n
