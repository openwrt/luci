-- Copyright 2017 Dirk Brenken (dev@brenken.org)
-- This is free software, licensed under the Apache License, Version 2.0

local http = require("luci.http")
local cfg = http.formvalue("cfg")
local dir = http.formvalue("dir")
local uci = require("luci.model.uci").cursor()
local trmiface = uci:get("travelmate", "global", "trm_iface") or "trm_wwan"

if cfg ~= nil then
	local iface = ""
	local section = ""
	local idx = ""
	local idx_change = ""
	if dir == "up" then
		uci:foreach("wireless", "wifi-iface", function(s)
			iface = s.network
			if iface == trmiface then
				section = s['.name']
				if cfg == section then
					idx = s['.index']
				else
					idx_change = s['.index']
				end
				if idx ~= "" and idx_change ~= "" and idx_change < idx then
					uci:reorder("wireless", cfg, idx_change)
					idx = ""
				end
			end
		end)
	elseif dir == "down" then
		uci:foreach("wireless", "wifi-iface", function(s)
			iface = s.network
			if iface == trmiface then
				section = s['.name']
				if cfg == section then
					idx = s['.index']
				else
					idx_change = s['.index']
				end
				if idx ~= "" and idx_change ~= "" and idx_change > idx then
					uci:reorder("wireless", cfg, idx_change)
					idx = ""
				end
			end
		end)
	end
	uci:save("wireless")
	uci:commit("wireless")
end
http.redirect(luci.dispatcher.build_url("admin/services/travelmate/stations"))
