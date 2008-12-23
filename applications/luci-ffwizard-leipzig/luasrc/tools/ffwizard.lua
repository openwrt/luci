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

local uci = require "luci.model.uci"
local util = require "luci.util"
local table = require "table"

local type = type

module "luci.tools.ffwizard"

-- Deletes all references of a wifi device
function wifi_delete_ifaces(device)
	local cursor = uci.cursor()
	cursor:delete_all("wireless", "wifi-iface", {device=device})
	cursor:save("wireless")
end

-- Deletes a network interface and all occurences of it in firewall zones and dhcp
function network_remove_interface(iface)
	local cursor = uci.cursor()

	if not cursor:delete("network", iface) then
		return false
	end

	local aliases = {iface}
	cursor:foreach("network", "alias",
		function(section)
			if section.interface == iface then
				table.insert(aliases, section[".name"])
			end
		end)

	-- Delete Aliases and Routes
	cursor:delete_all("network", "route", {interface=iface})
	cursor:delete_all("network", "alias", {interface=iface})

	-- Delete DHCP sections
	cursor:delete_all("dhcp", "dhcp",
		 function(section)
		 	return util.contains(aliases, section.interface)
		 end)

	-- Remove OLSR sections
	cursor:delete_all("olsrd", "Interface", {Interface=iface})

	-- Remove Splash sections
	cursor:delete_all("luci-splash", "iface", {network=iface})

	cursor:save("network")
	cursor:save("olsr")
	cursor:save("dhcp")
	cursor:save("luci-splash")
end

-- Creates a firewall zone
function firewall_create_zone(zone, input, output, forward, masq)
	local cursor = uci.cursor()
	if not firewall_find_zone(zone) then
		local stat = cursor:section("firewall", "zone", nil, {
			input = input,
			output = output,
			forward = forward,
			masq = masq and "1",
			name = zone
		})
		cursor:save("firewall")
		return stat
	end
end

-- Adds interface to zone, creates zone on-demand
function firewall_zone_add_interface(name, interface)
	local cursor = uci.cursor()
	local zone = firewall_find_zone(name)
	local net = cursor:get("firewall", zone, "network")
	local old = net or (cursor:get("network", name) and name)
	cursor:set("firewall", zone, "network", (old and old .. " " or "") .. interface)
	cursor:save("firewall")
end

-- Removes interface from zone
function firewall_zone_remove_interface(name, interface)
	local cursor = uci.cursor()
	local zone = firewall_find_zone(name)
	if zone then
		local net = cursor:get("firewall", zone, "network")
		local new = remove_list_entry(net, interface)
		if new then
			if #new > 0 then
				cursor:set("firewall", zone, "network", new)
			else
				cursor:delete("firewall", zone, "network")
			end
			cursor:save("firewall")
		end
	end
end


-- Finds the firewall zone with given name
function firewall_find_zone(name)
	local find

	uci.cursor():foreach("firewall", "zone",
		function (section)
			if section.name == name then
				find = section[".name"]
			end
		end)

	return find
end



-- Helpers --

-- Removes a listentry, handles real and pseduo lists transparently
function remove_list_entry(value, entry)
	if type(value) == "nil" then
		return nil
	end

	local result = type(value) == "table" and value or util.split(value, " ")
	local key = util.contains(result, entry)

	while key do
		table.remove(result, key)
		key = util.contains(result, entry)
	end

	result = type(value) == "table" and result or table.concat(result, " ")
	return result ~= value and result
end
