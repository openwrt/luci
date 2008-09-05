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


-------------------- View --------------------
f = SimpleForm("ffwizward", "Freifunkassistent",
 "Dieser Assistent unterstüzt bei der Einrichtung des Routers für das Freifunknetz.")


dev = f:field(ListValue, "device", "WLAN-Gerät")
uci:foreach("wireless", "wifi-device",
	function(section)
		dev:value(section[".name"])
	end)


main = f:field(Flag, "wifi", "Freifunkzugang einrichten")

net = f:field(Value, "net", "Freifunknetz")
net.rmempty = true
net:depends("wifi", "1")
net:value("104.61", "Leipzig (104.61)")
net:value("104.62", "Halle (104.62)")
function net.cfgvalue(self, section)
	return uci:get("freifunk", "wizard", "net")
end
function net.write(self, section, value)
	uci:set("freifunk", "wizard", "net", value)
	uci:save("freifunk")
end


subnet = f:field(ListValue, "subnet", "Subnetz (Projekt)")
subnet.rmempty = true
subnet:depends("wifi", "1")
for i=0, 255 do
	subnet:value(i)
end 
function subnet.cfgvalue(self, section)
	return uci:get("freifunk", "wizard", "subnet")
end
function subnet.write(self, section, value)
	uci:set("freifunk", "wizard", "subnet", value)
	uci:save("freifunk")
end

node = f:field(Value, "node", "Knoten")
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


olsr = f:field(Flag, "olsr", "OLSR einrichten")

share = f:field(ListValue, "sharenet", "Eigenen Internetzugang freigeben")
share:value("maybe", "-- keine Aktion --")
share:value("yes", "einschalten")
share:value("no", "ausschalten")



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

	-- Collect IP-Address
	local inet = net:formvalue(section)
	local isubnet = subnet:formvalue(section)
	local inode = node:formvalue(section)
	
	-- Invalidate fields
	if not inet then
		net.tag_missing[section] = true
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
		
	
	-- Tune wifi device
	local devconfig = _strip_internals(uci:get_all("freifunk", "wifi_device"))
	uci:tset("wireless", device, devconfig)
	
	-- Create wifi iface
	local ifconfig = _strip_internals(uci:get_all("freifunk", "wifi_iface"))
	ifconfig.device = device
	uci:section("wireless", "wifi-iface", nil, ifconfig)
	
	-- Save wifi
	uci:save("wireless")	
	
	-- Create firewall zone and add default rules (first time)
	local newzone = tools.firewall_create_zone("freifunk", "DROP", "ACCEPT", "DROP", true)
	if newzone then
		uci:foreach("freifunk", "fw_forwarding", function(section)
			uci:section("firewall", "forwarding", nil, _strip_internals(section))
		end)
		
		uci:foreach("freifunk", "fw_rule", function(section)
			uci:section("firewall", "rule", nil, _strip_internals(section))
		end)
		
		uci:save("firewall")
	end
	
	
	-- Crate network interface
	local netconfig = _strip_internals(uci:get_all("freifunk", "interface"))
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
	
	-- Delete old interface
	uci:delete_all("freifunk", "Interface", {Interface=device})
	
	-- Write new interface
	local olsrbase = _strip_internals(uci:get_all("freifunk", "olsr_interface"))
	olsrbase.Interface = device
	uci:section("olsr", "Interface", nil, olsrbase)
	uci:save("olsr")
end


function share.write(self, section, value)
	if value == "maybe" then
		return
	end
	
	uci:delete_all("firewall", "forwarding", {src="freifunk", dest="wan"})
	
	if value == "yes" then
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
	
	local dhcpbeg = 48 + tonumber(inode) * 4 
	local dclient = "%s.%s.%s" % {inet:gsub("^[0-9]+", "10"), isubnet, dhcpbeg}
	local limit = dhcpbeg < 252 and 3 or 2
	
	-- Delete old alias
	uci:delete("network", device .. "dhcp")
	
	-- Create alias
	local aliasbase = _strip_internals(uci:get_all("freifunk", "alias"))
	aliasbase.interface = device
	aliasbase.ipaddr = dclient
	aliasbase.proto = "static"
	uci:section("network", "alias", device .. "dhcp", aliasbase)
	uci:save("network")
	
	
	-- Create dhcp
	local dhcpbase = _strip_internals(uci:get_all("freifunk", "dhcp"))
	dhcpbase.interface = device .. "dhcp"
	dhcpbase.start = dhcpbeg
	dhcpbase.limit = limit

	uci:section("dhcp", "dhcp", device .. "dhcp", dhcpbase)
	uci:save("dhcp")
	
	
	-- Delete old splash
	uci:delete_all("luci_splash", "iface", {net=device, zone="freifunk"})
	
	-- Register splash
	uci:section("luci_splash", "iface", nil, {net=device, zone="freifunk"})
	uci:save("luci_splash")
end

return f