--[[

LuCI ip calculation libarary
(c) 2008 Jo-Philipp Wich <xm@leipzig.freifunk.net>
(c) 2008 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

$Id$

]]--

module( "luci.ip", package.seeall )

require("bit")
require("luci.util")

LITTLE_ENDIAN = not luci.util.bigendian()
BIG_ENDIAN    = not LITTLE_ENDIAN

FAMILY_INET4  = 0x04
FAMILY_INET6  = 0x06


local function __bless(x)
	return setmetatable( x, {
		__index	= luci.ip.cidr,
		__add   = luci.ip.cidr.add,
		__lt	= luci.ip.cidr.lower,
		__eq	= luci.ip.cidr.equal,
		__le	=
			function(...)
				return luci.ip.cidr.equal(...) or luci.ip.cidr.lower(...)
			end
	} )
end

local function __mask16(bits)
	return bit.lshift(
		bit.rshift( 0xFFFF, 16 - bits % 16 ),
		16 - bits % 16
	)
end

-- htons(), htonl(), ntohs(), ntohl()

function htons(x)
	if LITTLE_ENDIAN then
		return bit.bor(
			bit.rshift( x, 8 ),
			bit.band( bit.lshift( x, 8 ), 0xFF00 )
		)
	else
		return x
	end
end

function htonl(x)
	if LITTLE_ENDIAN then
		return bit.bor(
			bit.lshift( htons( bit.band( x, 0xFFFF ) ), 16 ),
			htons( bit.rshift( x, 16 ) )
		)
	else
		return x
	end
end

ntohs = htons
ntohl = htonl


function IPv4(address)
	local data = {}
	local prefix = address:match("/(.+)")

	if prefix then
		address = address:gsub("/.+","")
		prefix = tonumber(prefix)
		if not prefix or prefix < 0 or prefix > 32 then return nil end
	else
		prefix = 32
	end

	local b1, b2, b3, b4 = address:match("(%d+)%.(%d+)%.(%d+)%.(%d+)")

	b1 = tonumber(b1)
	b2 = tonumber(b2)
	b3 = tonumber(b3)
	b4 = tonumber(b4)

	if b1 and b1 <= 255 and
	   b2 and b2 <= 255 and
	   b3 and b3 <= 255 and
	   b4 and b4 <= 255
	then
		return __bless({
			FAMILY_INET4,
			{ b1 * 256 + b2, b3 * 256 + b4 },
			prefix
		})
	end
end

function IPv6(address)
	local data = {}
	local prefix = address:match("/(.+)")

	if prefix then
		address = address:gsub("/.+","")
		prefix = tonumber(prefix)
		if not prefix or prefix < 0 or prefix > 128 then return nil end
	else
		prefix = 128
	end

	local borderl = address:sub(1, 1) == ":" and 2 or 1
	local borderh, zeroh, chunk, block

	if #address > 45 then return nil end

	repeat
		borderh = address:find(":", borderl, true)
		if not borderh then break end

		block = tonumber(address:sub(borderl, borderh - 1), 16)
		if block and block <= 65535 then
			table.insert(data, block)
		else
			if zeroh or borderh - borderl > 1 then return nil end
			zeroh = #data + 1
		end

		borderl = borderh + 1
	until #data == 7

	chunk = address:sub(borderl)
	if #chunk > 0 and #chunk <= 4 then
		block = tonumber(chunk, 16)
		if not block or block > 65535 then return nil end

		table.insert(data, block)
	elseif #chunk > 4 then
		if #data == 7 or #chunk > 15 then return nil end
		borderl = 1
		for i=1, 4 do
			borderh = chunk:find(".", borderl, true)
			if not borderh and i < 4 then return nil end
			borderh = borderh and borderh - 1

			block = tonumber(chunk:sub(borderl, borderh))
			if not block or block > 255 then return nil end

			if i == 1 or i == 3 then
				table.insert(data, block * 256)
			else
				data[#data] = data[#data] + block
			end

			borderl = borderh and borderh + 2
		end
	end

	if zeroh then
		if #data == 8 then return nil end
		while #data < 8 do
			table.insert(data, zeroh, 0)
		end
	end

	if #data == 8 then
		return __bless({ FAMILY_INET6, data, prefix })
	end
end


cidr = luci.util.class()

function cidr.is4( self )
	return self[1] == FAMILY_INET4
end

function cidr.is6( self )
	return self[1] == FAMILY_INET6
end

function cidr.string( self )
	local str
	if self:is4() then
		str = string.format(
			"%d.%d.%d.%d",
			bit.rshift(self[2][1], 8), bit.band(self[2][1], 0xFF),
			bit.rshift(self[2][2], 8), bit.band(self[2][2], 0xFF)
		)
		if self[3] < 32 then
			str = str .. "/" .. self[3]
		end
	elseif self:is6() then
		str = string.format( "%X:%X:%X:%X:%X:%X:%X:%X", unpack(self[2]) )
		if self[3] < 128 then
			str = str .. "/" .. self[3]
		end
	end
	return str
end

function cidr.lower( self, addr )
	assert( self[1] == addr[1], "Can't compare IPv4 and IPv6 addresses" )
	for i = 1, #self[2] do
		if self[2][i] ~= addr[2][i] then
			return self[2][i] < addr[2][i]
		end
	end
	return false
end

function cidr.higher( self, addr )
	assert( self[1] == addr[1], "Can't compare IPv4 and IPv6 addresses" )
	for i = 1, #self[2] do
		if self[2][i] ~= addr[2][i] then
			return self[2][i] > addr[2][i]
		end
	end
	return false
end

function cidr.equal( self, addr )
	assert( self[1] == addr[1], "Can't compare IPv4 and IPv6 addresses" )
	for i = 1, #self[2] do
		if self[2][i] ~= addr[2][i] then
			return false
		end
	end
	return true
end

function cidr.prefix( self )
	return self[3]
end

function cidr.network( self )
	local data = { }

	for i = 1, math.floor( self[3] / 16 ) do
		table.insert( data, self[2][i] )
	end

	table.insert( data, bit.band( self[2][1+#data], __mask16(self[3]) ) )

	for i = #data, #self[2] do
		table.insert( data, 0 )
	end

	return __bless({ self[1], data, self:is4() and 32 or 128 })
end

function cidr.host( self )
	return __bless({ self[1], data, self:is4() and 32 or 128 })
end

function cidr.mask( self, bits )
	local data = { }
	bits = bits or self[3]

	for i = 1, math.floor( bits / 16 ) do
		table.insert( data, 0xFFFF )
	end

	table.insert( data, __mask16(bits) )

	for i = #data + 1, #self[2] do
		table.insert( data, 0 )
	end

	return __bless({ self[1], data, self:is4() and 32 or 128 })
end

function cidr.contains( self, addr )
	if self:mask() <= addr:mask() then
		return self:mask(addr:prefix()) == addr:mask()
	end

	return false
end

function cidr.add( self, amount )
	local shorts = { bit.rshift(amount, 16), bit.band(amount, 0xFFFF) }
	local data   = { unpack(self[2]) }

	for pos = #data, 1, -1 do
		local add = ( #shorts > 0 ) and table.remove( shorts, #shorts ) or 0
		if ( data[pos] + add ) > 0xFFFF then
			data[pos] = ( data[pos] + add ) % 0xFFFF
			if pos > 2 then
				data[pos-1] = data[pos-1] + ( add - data[pos] )
			end
		else
			data[pos] = data[pos] + add
		end
	end

	return __bless({ self[1], data, self[3] })
end
