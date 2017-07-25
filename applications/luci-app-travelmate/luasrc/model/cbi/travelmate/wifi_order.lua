-- Copyright 2017 Dirk Brenken (dev@brenken.org)
-- This is free software, licensed under the Apache License, Version 2.0

local uci = require("luci.model.uci").cursor()
local http = require("luci.http")
local cfg = http.formvalue("cfg")
local pos = http.formvalue("pos")
local dir = http.formvalue("dir")

if cfg ~= nil then
	if dir == "up" then
		pos = pos - 1
		uci:reorder("wireless", cfg, pos)
	elseif dir == "down" then
		pos = pos + 1
		uci:reorder("wireless", cfg, pos)
	end
	uci:save("wireless")
	uci:commit("wireless")
end

http.redirect(luci.dispatcher.build_url("admin/services/travelmate/stations"))
