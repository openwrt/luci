--[[
LuCI - Lua Configuration Interface

Copyright 2011 Manuel Munz <freifunk at somakoma dot de>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	httc://www.apache.org/licenses/LICENSE-2.0
]]--

local uci = require "luci.model.uci".cursor()
local community = uci:get("freifunk", "community", "name")
luci.i18n.loadc("freifunk")

if community == nil then
	luci.http.redirect(luci.dispatcher.build_url("admin", "freifunk", "profile_error"))
	return
else
	community = "profile_" .. community
	m = Map(community, translate("Community settings"), translate("These are the settings of your local community."))
	c = m:section(NamedSection, "profile", "community")

	name = c:option(Value, "name", "Name")
	name.rmempty = false

	homepage = c:option(Value, "homepage", translate("Homepage"))

	cc = c:option(Value, "country", translate("Country code"))
	function cc.cfgvalue(self, section)
		return uci:get(community, "wifi_device", "country")
	end
	function cc.write(self, sec, value)
		if value then
			uci:set(community, "wifi_device", "country", value)
			uci:save(community)
		end
	end

	ssid = c:option(Value, "ssid", translate("ESSID"))
	ssid.rmempty = false

	prefix = c:option(Value, "mesh_network", translate("Mesh prefix"))
	prefix.rmempty = false

	splash_net = c:option(Value, "splash_network", translate("Network for client DHCP addresses"))
	splash_net.rmempty = false

	splash_prefix = c:option(Value, "splash_prefix", translate("Client network size"))
	splash_prefix.rmempty = false

	lat = c:option(Value, "latitude", translate("Latitude"))
	lat.rmempty = false

	lon = c:option(Value, "longitude", translate("Longitude"))
	lon.rmempty = false
	return m
end
