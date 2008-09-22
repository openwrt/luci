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


local uci = require "luci.model.uci".cursor()
local tools = require "luci.tools.ffwizard"
local util = require "luci.util"


-------------------- View --------------------
f = SimpleForm("ffwizward", "Freifunkassistent",
 "Dieser Assistent unterstüzt bei der Einrichtung des Routers für das Freifunknetz.")


dev = f:field(ListValue, "device", "WLAN-Gerät")
uci:foreach("wireless", "wifi-device",
	function(section)
		dev:value(section[".name"])
	end)


main = f:field(Flag, "wifi", "Freifunkzugang einrichten")

net = f:field(Value, "net", "Freifunknetz", "1. Teil der IP-Adresse")
net.rmempty = true
net:depends("wifi", "1")
uci:foreach("freifunk", "community", function(s)
	net:value(s[".name"], "%s (%s)" % {s.name, s.prefix})
end)

function net.cfgvalue(self, section)
	return uci:get("freifunk", "wizard", "net")
end
function net.write(self, section, value)
	uci:set("freifunk", "wizard", "net", value)
	uci:save("freifunk")
end


subnet = f:field(Value, "subnet", "Subnetz (Projekt)", "2. Teil der IP-Adresse")
subnet.rmempty = true
subnet:depends("wifi", "1")
function subnet.cfgvalue(self, section)
	return uci:get("freifunk", "wizard", "subnet")
end
function subnet.write(self, section, value)
	uci:set("freifunk", "wizard", "subnet", value)
	uci:save("freifunk")
end

node = f:field(Value, "node", "Knoten", "3. Teil der IP-Adresse")
node.rmempty = true
node:depends("wifi", "1")
for i=1, 51 do
	node:value(i)
end
function node.cfgvalue(self, section)
	return uci:get("freifunk", "wizard", "node")
end
function node.write(self, section, value)
	uci:set("freifunk", "wizard", "node", value)
	uci:save("freifunk")
end

client = f:field(Flag, "client", "WLAN-DHCP anbieten")
client:depends("wifi", "1")
client.rmempty = true


olsr = f:field(Flag, "olsr", "OLSR einrichten")
olsr.rmempty = true

share = f:field(Flag, "sharenet", "Eigenen Internetzugang freigeben")
share.rmempty = true



-------------------- Control --------------------
function f.handle(self, state, data)
	if state == FORM_VALID then
		luci.http.redirect(luci.dispatcher.build_url("admin", "uci", "changes"))
		return false
	elseif state == FORM_INVALID then
		self.errmessage = "Ungültige Eingabe: Bitte die Formularfelder auf Fehler prüfen."
	end
	return true
end

local function _strip_internals(tbl)
	tbl = tbl or {}
	for k, v in pairs(tbl) do
		if k:sub(1, 1) == "." then
			tbl[k] = nil
		end
	end
	return tbl
end

-- Configure Freifunk checked
function main.write(self, section, value)
	if value == "0" then
		return
	end

	local device = dev:formvalue(section)
	local community, external

	-- Collect IP-Address
	local inet = net:formvalue(section)
	local isubnet = subnet:formvalue(section)
	local inode = node:formvalue(section)

	-- Invalidate fields
	if not inet then
		net.tag_missing[section] = true
	else
		community = inet
		external  = uci:get("freifunk", community, "external") or ""
		inet = uci:get("freifunk", community, "prefix") or inet
	end
	if not isubnet then
		subnet.tag_missing[section] = true
	end
	if not inode then
		node.tag_missing[section] = true
	end

	if not inet or not isubnet or not inode then
		return
	end

	local ip = "%s.%s.%s" % {inet, isubnet, inode}


	-- Cleanup
	tools.wifi_delete_ifaces(device)
	tools.network_remove_interface(device)
	tools.firewall_zone_remove_interface("freifunk", device)

	-- Tune community settings
	if community and uci:get("freifunk", community) then
		uci:tset("freifunk", "community", uci:get_all("freifunk", community))
	end

	-- Tune wifi device
	local devconfig = uci:get_all("freifunk", "wifi_device")
	util.update(devconfig, uci:get_all(external, "wifi_device") or {})
	uci:tset("wireless", device, devconfig)

	-- Create wifi iface
	local ifconfig = uci:get_all("freifunk", "wifi_iface")
	util.update(ifconfig, uci:get_all(external, "wifi_iface") or {})
	ifconfig.device = device
	ifconfig.network = device
	ifconfig.ssid = uci:get("freifunk", community, "ssid")
	uci:section("wireless", "wifi-iface", nil, ifconfig)

	-- Save wifi
	uci:save("wireless")

	-- Create firewall zone and add default rules (first time)
	local newzone = tools.firewall_create_zone("freifunk", "DROP", "ACCEPT", "DROP", true)
	if newzone then
		uci:foreach("freifunk", "fw_forwarding", function(section)
			uci:section("firewall", "forwarding", nil, section)
		end)
		uci:foreach(external, "fw_forwarding", function(section)
			uci:section("firewall", "forwarding", nil, section)
		end)

		uci:foreach("freifunk", "fw_rule", function(section)
			uci:section("firewall", "rule", nil, section)
		end)
		uci:foreach(external, "fw_rule", function(section)
			uci:section("firewall", "rule", nil, section)
		end)

		uci:save("firewall")
	end


	-- Crate network interface
	local netconfig = uci:get_all("freifunk", "interface")
	util.update(netconfig, uci:get_all(external, "interface") or {})
	netconfig.proto = "static"
	netconfig.ipaddr = ip
	uci:section("network", "interface", device, netconfig)

	uci:save("network")

	tools.firewall_zone_add_interface("freifunk", device)
end


function olsr.write(self, section, value)
	if value == "0" then
		return
	end


	local device = dev:formvalue(section)

	local community = net:formvalue(section)
	local external  = community and uci:get("freifunk", community, "external") or ""

	-- Delete old interface
	uci:delete_all("olsrd", "Interface", {interface=device})

	-- Write new interface
	local olsrbase = uci:get_all("freifunk", "olsr_interface")
	util.update(olsrbase, uci:get_all(external, "olsr_interface") or {})
	olsrbase.interface = device
	olsrbase.ignore    = "0"
	uci:section("olsrd", "Interface", nil, olsrbase)
	uci:save("olsrd")
end


function share.write(self, section, value)
	uci:delete_all("firewall", "forwarding", {src="freifunk", dest="wan"})

	if value == "1" then
		uci:section("firewall", "forwarding", nil, {src="freifunk", dest="wan"})
	end
	uci:save("firewall")
end


function client.write(self, section, value)
	if value == "0" then
		return
	end

	local device = dev:formvalue(section)

	-- Collect IP-Address
	local inet = net:formvalue(section)
	local isubnet = subnet:formvalue(section)
	local inode = node:formvalue(section)

	if not inet or not isubnet or not inode then
		return
	end
	local community = inet
	local external  = community and uci:get("freifunk", community, "external") or ""
	inet = uci:get("freifunk", community, "prefix") or inet

	local dhcpbeg = 48 + tonumber(inode) * 4
	local dclient = "%s.%s.%s" % {inet:gsub("^[0-9]+", "10"), isubnet, dhcpbeg}
	local limit = dhcpbeg < 252 and 3 or 2

	-- Delete old alias
	uci:delete("network", device .. "dhcp")

	-- Create alias
	local aliasbase = uci:get_all("freifunk", "alias")
	util.update(aliasbase, uci:get_all(external, "alias") or {})
	aliasbase.interface = device
	aliasbase.ipaddr = dclient
	aliasbase.proto = "static"
	uci:section("network", "alias", device .. "dhcp", aliasbase)
	uci:save("network")


	-- Create dhcp
	local dhcpbase = uci:get_all("freifunk", "dhcp")
	util.update(dhcpbase, uci:get_all(external, "dhcp") or {})
	dhcpbase.interface = device .. "dhcp"
	dhcpbase.start = dhcpbeg
	dhcpbase.limit = limit

	uci:section("dhcp", "dhcp", device .. "dhcp", dhcpbase)
	uci:save("dhcp")

	uci:delete_all("firewall", "rule", {
		src="freifunk",
		proto="udp",
		src_port="68",
		dest_port="67"
	})
	uci:section("firewall", "rule", nil, {
		src="freifunk",
		proto="udp",
		src_port="68",
		dest_port="67",
		target="ACCEPT"
	})
	uci:delete_all("firewall", "rule", {
		src="freifunk",
		proto="tcp",
		dest_port="8082",
	})
	uci:section("firewall", "rule", nil, {
		src="freifunk",
		proto="tcp",
		dest_port="8082",
		target="ACCEPT"
	})



	-- Delete old splash
	uci:delete_all("luci_splash", "iface", {net=device, zone="freifunk"})

	-- Register splash
	uci:section("luci_splash", "iface", nil, {net=device, zone="freifunk"})
	uci:save("luci_splash")
end

return f
