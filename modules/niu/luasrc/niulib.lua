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

local uci = require "luci.model.uci"
local cursor = uci.inst
local state = uci.inst_state


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

function eth_get_bridged(except)
	local devs = state:get("network", except, "device") or ""
	
	local ifs = {}
	local cnt = 0
	for x in devs:gmatch("[^ ]+") do
		cnt = cnt + 1
		if x:find("eth") == 1 then
			ifs[#ifs+1] = x
		end
	end
	return cnt > 1 and ifs or {}
end

function wifi_get_available(except, types)
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
			used[k] = (iwinfo[t].mbssid_support(k) < 1)
		end
	end

	local wifis = {}
	cursor:foreach("wireless", "wifi-device", function(s)
		if not used[s[".name"]] and (not types or types[s.type]) then
			wifis[#wifis+1] = s[".name"]
		end
	end)
	return wifis
end

