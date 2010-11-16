--[[

LuCI - Configuration Bind Interface - Datatype Tests
(c) 2010 Jo-Philipp Wich <xm@subsignal.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

$Id$

]]--

local fs = require "nixio.fs"
local ip = require "luci.ip"
local math = require "math"
local util = require "luci.util"

local tonumber = tonumber

module "luci.cbi.datatypes"


function bool(val)
	if val == "1" or val == "yes" or val == "on" or val == "true" then
		return true
	elseif val == "0" or val == "no" or val == "off" or val == "false" then
		return true
	elseif val == "" or val == nil then
		return true
	end

	return false
end

function uint(val)
	local n = tonumber(val)
	if n ~= nil and math.floor(n) == n and n >= 0 then
		return true
	end

	return false
end

function int(val)
	local n = tonumber(val)
	if n ~= nil and math.floor(n) == n then
		return true
	end

	return false
end

function float(val)
	return ( tonumber(val) ~= nil )
end

function ipaddr(val)
	return ip4addr(val) or ip6addr(val)
end

function ip4addr(val)
	if val then
		return ip.IPv4(val) and true or false
	end

	return false
end

function ip4prefix(val)
	val = tonumber(val)
	return ( val and val >= 0 and val <= 32 )
end

function ip6addr(val)
	if val then
		return ip.IPv6(val) and true or false
	end

	return false
end

function ip6prefix(val)
	val = tonumber(val)
	return ( val and val >= 0 and val <= 128 )
end

function port(val)
	val = tonumber(val)
	return ( val and val >= 1 and val <= 65535 )
end

function portrange(val)
	local p1, p2 = val:match("^(%d+)%-(%d+)$")
	if p1 and p2 and port(p1) and port(p2) then
		return true
	else
		return port(val)
	end
end

function macaddr(val)
	if val and val:match(
		"^[a-fA-F0-9]+:[a-fA-F0-9]+:[a-fA-F0-9]+:" ..
		 "[a-fA-F0-9]+:[a-fA-F0-9]+:[a-fA-F0-9]+$"
	) then
		local parts = util.split( val, ":" )

		for i = 1,6 do
			parts[i] = tonumber( parts[i], 16 )
			if parts[i] < 0 or parts[i] > 255 then
				return false
			end
		end

		return true
	end

	return false
end

function hostname(val)
	if val and val:match("[a-zA-Z0-9_][a-zA-Z0-9_%-%.]*") then
		return true	-- XXX: ToDo: need better solution
	end

	return false
end

function host(val)
	return hostname(val) or ipaddr(val)
end

function wpakey(val)
	if #val == 64 then
		return (val:match("^[a-fA-F0-9]+$") ~= nil)
	else
		return (#val >= 8) and (#val <= 63)
	end
end

function wepkey(val)
	if val:sub(1, 2) == "s:" then
		val = val:sub(3)
	end

	if (#val == 10) or (#val == 26) then
		return (val:match("^[a-fA-F0-9]+$") ~= nil)
	else
		return (#v == 5) or (#v == 13)
	end
end

function string(val)
	return true		-- Everything qualifies as valid string
end

function directory( val, seen )
	local s = fs.stat(val)
	seen = seen or { }

	if s and not seen[s.ino] then
		seen[s.ino] = true
		if s.type == "dir" then
			return true
		elseif s.type == "lnk" then
			return directory( fs.readlink(val), seen )
		end
	end

	return false
end

function file( val, seen )
	local s = fs.stat(val)
	seen = seen or { }

	if s and not seen[s.ino] then
		seen[s.ino] = true
		if s.type == "reg" then
			return true
		elseif s.type == "lnk" then
			return file( fs.readlink(val), seen )
		end
	end

	return false
end

function device( val, seen )
	local s = fs.stat(val)
	seen = seen or { }

	if s and not seen[s.ino] then
		seen[s.ino] = true
		if s.type == "chr" or s.type == "blk" then
			return true
		elseif s.type == "lnk" then
			return device( fs.readlink(val), seen )
		end
	end

	return false
end

function uciname(val)
	return (val:match("^[a-zA-Z0-9_]+$") ~= nil)
end

function range(val, min, max)
	val = tonumber(val)
	min = tonumber(min)
	max = tonumber(max)

	if val ~= nil and min ~= nil and max ~= nil then
		return ((val >= min) and (val <= max))
	end

	return false
end
