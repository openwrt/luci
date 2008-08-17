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

module("luci.tools.webadmin", package.seeall)
require("luci.model.uci")
require("luci.sys")
require("luci.ip")

function byte_format(byte)
	local suff = {"B", "KB", "MB", "GB", "TB"}
	for i=1, 5 do
		if byte > 1024 and i < 5 then
			byte = byte / 1024
		else
			return string.format("%.2f %s", byte, suff[i]) 
		end 
	end
end

function date_format(secs)
	local suff = {"min", "h", "d"}
	local mins = 0
	local hour = 0
	local days = 0
	if secs > 60 then
		mins = math.floor(secs / 60)
		secs = secs % 60
	end
	
	if mins > 60 then
		hour = math.floor(mins / 60)
		mins = mins % 60
	end
	
	if hour > 24 then
		days = math.floor(hours / 24)
		hour = hour % 24
	end
	
	if days > 0 then
		return string.format("%dd %02dh %02dmin %02ds", days, hour, mins, secs)
	else
		return string.format("%02dh %02dmin %02ds", hour, mins, secs)
	end
end

function network_get_addresses(net)
	luci.model.uci.load_state("network")
	local addr = {}
	local ipv4 = luci.model.uci.get("network", net, "ipaddr")
	local mav4 = luci.model.uci.get("network", net, "netmask")
	local ipv6 = luci.model.uci.get("network", net, "ip6addr")
	
	if ipv4 and mav4 then
		ipv4 = luci.ip.IPv4(ipv4, mav4)
		
		if ipv4 then 
			table.insert(addr, ipv4:string())
		end
	end

	if ipv6 then
		table.insert(addr, ipv6)
	end
	
	luci.model.uci.foreach("network", "alias",
		function (section)
			if section.interface == net then
				if section.ipaddr and section.netmask then
					local ipv4 = luci.ip.IPv4(section.ipaddr, section.netmask)
					
					if ipv4 then
						table.insert(addr, ipv4:string())
					end
				end
				
				if section.ip6addr then
					table.insert(addr, section.ip6addr)
				end
			end
		end
	)
	
	return addr
end

function cbi_add_networks(field)
	luci.model.uci.foreach("network", "interface",
		function (section)
			if section[".name"] ~= "loopback" then
				field:value(section[".name"])
			end
		end
	)
	field.titleref = luci.dispatcher.build_url("admin", "network", "network")
end

function cbi_add_knownips(field)
	for i, dataset in ipairs(luci.sys.net.arptable()) do
		field:value(dataset["IP address"])
	end
end

function network_get_zones(net)
	if not luci.model.uci.load_state("firewall") then
		return nil
	end
	
	local zones = {}
	
	luci.model.uci.foreach("firewall", "zone", 
		function (section)
			local znet = section.network or section.name
			if luci.util.contains(luci.util.split(znet, " "), net) then
				table.insert(zones, section.name)
			end
		end
	)
	
	return zones
end

function firewall_find_zone(name)
	local find
	
	luci.model.uci.foreach("firewall", "zone", 
		function (section)
			if section.name == name then
				find = section[".name"]
			end
		end
	)
	
	return find
end

function iface_get_network(iface)
	luci.model.uci.load_state("network")
	local net
	
	luci.model.uci.foreach("network", "interface",
		function (section)
			local ifname = luci.model.uci.get(
				"network", section[".name"], "ifname"
			)
			
			if iface == ifname then
				net = section[".name"]
			end
		end
	)
	
	return net
end