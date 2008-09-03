--[[

UCI Validation Layer - Datatype Tests
(c) 2008 Jo-Philipp Wich <xm@leipzig.freifunk.net>
(c) 2008 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

$Id$

]]--

module( "luci.uvl.datatypes", package.seeall )

require("luci.fs")
require("luci.ip")
require("luci.util")


function boolean( val )
	if val == "1" or val == "yes" or val == "on" then
		return true
	elseif val == "0" or val == "no" or val == "off" then
		return true
	end

	return false
end

function uint( val )
	local n = tonumber(val)
	if n ~= nil and math.floor(n) == n and n >= 0 then
		return true
	end

	return false
end

function integer( val )
	local n = tonumber(val)
	if n ~= nil and math.floor(n) == n then
		return true
	end

	return false
end

function float( val )
	return ( tonumber(val) ~= nil )
end

function ipaddr( val )
	return ip4addr(val) or ip6addr(val)
end

function ip4addr( val )
	if val then
		return luci.ip.IPv4(val) and true or false
	end

	return false
end

function ip4prefix( val )
	val = tonumber(val)
	return ( val and val >= 0 and val <= 32 )
end

function ip6addr( val )
	if val then
		return luci.ip.IPv6(val) and true or false
	end

	return false
end

function ip6prefix( val )
	val = tonumber(val)
	return ( val and val >= 0 and val <= 128 )
end

function macaddr( val )
	if val and val:match(
		"^[a-fA-F0-9]+:[a-fA-F0-9]+:[a-fA-F0-9]+:" ..
		 "[a-fA-F0-9]+:[a-fA-F0-9]+:[a-fA-F0-9]+$"
	) then
		local parts = luci.util.split( val, ":" )

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

function hostname( val )
	if val and val:match("[a-zA-Z0-9_][a-zA-Z0-9_%-%.]*") then
		return true	-- XXX: ToDo: need better solution
	end

	return false
end

function string( val )
	return true		-- Everything qualifies as valid string
end

function directory( val, seen )
	local s = luci.fs.stat( val )
	seen = seen or { }

	if s and not seen[s.ino] then
		seen[s.ino] = true
		if s.type == "directory" then
			return true
		elseif s.type == "link" then
			return directory( luci.fs.readlink(val), seen )
		end
	end

	return false
end

function file( val, seen )
	local s = luci.fs.stat( val )
	seen = seen or { }

	if s and not seen[s.ino] then
		seen[s.ino] = true
		if s.type == "regular" then
			return true
		elseif s.type == "link" then
			return file( luci.fs.readlink(val), seen )
		end
	end

	return false
end
