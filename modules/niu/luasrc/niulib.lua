--[[
LuCI - Lua Configuration Interface

Copyright 2009 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--

local ipairs, pairs, require = ipairs, pairs, require
local os = require "os"

local cursor = require "luci.model.uci".inst


module "luci.niulib"

function eth_get_available(except)
	local nw = require "luci.model.network"
	nw.init(cursor)

	local ifs = {}
	for _, iface in ipairs(nw.get_interfaces()) do
		if iface:name():find("eth") == 1 then
			local net = iface:get_network()
			if not net or net:name() == except or os.getenv("LUCI_SYSROOT") then
				ifs[#ifs+1] = iface:name()
			end
		end
	end
	return ifs
end

function wifi_get_available(except)
	cursor:unload("wireless")

	local iwinfo = require "iwinfo"
	local used = {}
	cursor:foreach("wireless", "wifi-iface", function(s)
		if s[".name"] ~= except and s._niu == 1 then
			used[s.device] = 1
		end
	end)

	for k in pairs(used) do
		local t = iwinfo.type(k)
		if t and iwinfo[t] then
			used[k] = (iwinfo[t].mbssid_support() < 1)
		end
	end

	local wifis = {}
	cursor:foreach("wireless", "wifi-device", function(s)
		if not used[s[".name"]] then
			wifis[#wifis+1] = s[".name"]
		end
	end)
	return wifis
end

