--[[
LuCI - Lua Configuration Interface

Copyright 2011-2012 Manuel Munz <freifunk at somakoma dot de>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	httc://www.apache.org/licenses/LICENSE-2.0
]]--

local uci = require "luci.model.uci".cursor()
local ipkg = require "luci.model.ipkg"
local community = uci:get("freifunk", "community", "name")

if community == nil then
	luci.http.redirect(luci.dispatcher.build_url("admin", "freifunk", "profile_error"))
	return
else
	community = "profile_" .. community
	m = Map(community, translate("Community settings"), translate("These are the settings of your local community."))
	c = m:section(NamedSection, "profile", "community")

	local name = c:option(Value, "name", "Name")
	name.rmempty = false

	local homepage = c:option(Value, "homepage", translate("Homepage"))

	local cc = c:option(Value, "country", translate("Country code"))
	function cc.cfgvalue(self, section)
		return uci:get(community, "wifi_device", "country")
	end
	function cc.write(self, sec, value)
		if value then
			uci:set(community, "wifi_device", "country", value)
			uci:save(community)
		end
	end

	local ssid = c:option(Value, "ssid", translate("ESSID"))
	ssid.rmempty = false

	local prefix = c:option(Value, "mesh_network", translate("Mesh prefix"))
	prefix.datatype = "ip4addr"
	prefix.rmempty = false

	local splash_net = c:option(Value, "splash_network", translate("Network for client DHCP addresses"))
	splash_net.datatype = "ip4addr"
	splash_net.rmempty = false

	local splash_prefix = c:option(Value, "splash_prefix", translate("Client network size"))
	splash_prefix.datatype = "range(0,32)"
	splash_prefix.rmempty = false

	local ipv6 = c:option(Flag, "ipv6", translate("Enable IPv6"))
	ipv6.rmempty = true

        local ipv6_config = c:option(ListValue, "ipv6_config", translate("IPv6 Config"))
	ipv6_config:depends("ipv6", 1)
	ipv6_config:value("static")
	if ipkg.installed ("auto-ipv6-ib") then
		ipv6_config:value("auto-ipv6-random")
		ipv6_config:value("auto-ipv6-fromv4")
	end
	ipv6_config.rmempty = true

	local ipv6_prefix = c:option(Value, "ipv6_prefix", translate("IPv6 Prefix"), translate("IPv6 network in CIDR notation."))
	ipv6_prefix:depends("ipv6", 1)
	ipv6_prefix.datatype = "ip6addr"
	ipv6_prefix.rmempty = true

	local lat = c:option(Value, "latitude", translate("Latitude"))
	lat.datatype = "range(-180, 180)"
	lat.rmempty = false

	local lon = c:option(Value, "longitude", translate("Longitude"))
	lon.rmempty = false
	return m
end
