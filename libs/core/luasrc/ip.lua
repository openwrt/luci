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

--- LuCI IP calculation library.
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
		__sub   = luci.ip.cidr.sub,
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

local function __length(family)
	if family == FAMILY_INET4 then
		return 32
	else
		return 128
	end
end

--- Convert given short value to network byte order on little endian hosts
-- @param x	Unsigned integer value between 0x0000 and 0xFFFF
-- @return	Byte-swapped value
-- @see		htonl
-- @see		ntohs
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

--- Convert given long value to network byte order on little endian hosts
-- @param x	Unsigned integer value between 0x00000000 and 0xFFFFFFFF
-- @return	Byte-swapped value
-- @see		htons
-- @see		ntohl
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

--- Convert given short value to host byte order on little endian hosts
-- @class	function
-- @name	ntohs
-- @param x	Unsigned integer value between 0x0000 and 0xFFFF
-- @return	Byte-swapped value
-- @see		htonl
-- @see		ntohs
ntohs = htons

--- Convert given short value to host byte order on little endian hosts
-- @class	function
-- @name	ntohl
-- @param x	Unsigned integer value between 0x00000000 and 0xFFFFFFFF
-- @return	Byte-swapped value
-- @see		htons
-- @see		ntohl
ntohl = htonl


--- Parse given IPv4 address in dotted quad or CIDR notation. If an optional
-- netmask is given as second argument and the IP address is encoded in CIDR
-- notation then the netmask parameter takes precedence. If neither a CIDR
-- encoded prefix nor a netmask parameter is given, then a prefix length of
-- 32 bit is assumed.
-- @param address	IPv4 address in dotted quad or CIDR notation
-- @param netmask	IPv4 netmask in dotted quad notation (optional)
-- @return			luci.ip.cidr instance or nil if given address was invalid
-- @see				IPv6
-- @see				Hex
function IPv4(address, netmask)
	address = address or "0.0.0.0/0"

	local obj = __bless({ FAMILY_INET4 })

	local data = {}
	local prefix = address:match("/(.+)")
	address = address:gsub("/.+","")

	if netmask then
		prefix = obj:prefix(netmask)
	elseif prefix then
		prefix = tonumber(prefix)
		if not prefix or prefix < 0 or prefix > 32 then return nil end
	else
		prefix = 32
	end

	local b1, b2, b3, b4 = address:match("^(%d+)%.(%d+)%.(%d+)%.(%d+)$")

	b1 = tonumber(b1)
	b2 = tonumber(b2)
	b3 = tonumber(b3)
	b4 = tonumber(b4)

	if b1 and b1 <= 255 and
	   b2 and b2 <= 255 and
	   b3 and b3 <= 255 and
	   b4 and b4 <= 255 and
	   prefix
	then
		table.insert(obj, { b1 * 256 + b2, b3 * 256 + b4 })
		table.insert(obj, prefix)
		return obj
	end
end

--- Parse given IPv6 address in full, compressed, mixed or CIDR notation.
-- If an optional netmask is given as second argument and the IP address is
-- encoded in CIDR notation then the netmask parameter takes precedence.
-- If neither a CIDR encoded prefix nor a netmask parameter is given, then a
-- prefix length of 128 bit is assumed.
-- @param address	IPv6 address in full/compressed/mixed or CIDR notation
-- @param netmask	IPv6 netmask in full/compressed/mixed notation (optional)
-- @return			luci.ip.cidr instance or nil if given address was invalid
-- @see				IPv4
-- @see				Hex
function IPv6(address, netmask)
	address = address or "::/0"

	local obj = __bless({ FAMILY_INET6 })

	local data = {}
	local prefix = address:match("/(.+)")
	address = address:gsub("/.+","")

	if netmask then
		prefix = obj:prefix(netmask)
	elseif prefix then
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
		if block and block <= 0xFFFF then
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
		if not block or block > 0xFFFF then return nil end

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

	if #data == 8 and prefix then
		table.insert(obj, data)
		table.insert(obj, prefix)
		return obj
	end
end

--- Transform given hex-encoded value to luci.ip.cidr instance of specified
-- address family.
-- @param hex		String containing hex encoded value
-- @param prefix	Prefix length of CIDR instance (optional, default is 32/128)
-- @param family	Address family, either luci.ip.FAMILY_INET4 or FAMILY_INET6
-- @param swap		Bool indicating whether to swap byteorder on low endian host
-- @return			luci.ip.cidr instance or nil if given value was invalid
-- @see				IPv4
-- @see				IPv6
function Hex( hex, prefix, family, swap )
	family = ( family ~= nil ) and family or FAMILY_INET4
	swap   = ( swap   == nil ) and true   or swap
	prefix = prefix or __length(family)

	local len  = __length(family)
	local tmp  = ""
	local data = { }

	for i = 1, (len/4) - #hex do tmp = tmp .. '0' end

	if swap and LITTLE_ENDIAN then
		for i = #hex, 1, -2 do tmp = tmp .. hex:sub( i - 1, i ) end
	else
		tmp = tmp .. hex
	end

	hex = tmp

	for i = 1, ( len / 4 ), 4 do
		local n = tonumber( hex:sub( i, i+3 ), 16 )
		if n then
			table.insert( data, n )
		else
			return nil
		end
	end

	return __bless({ family, data, len })
end


--- LuCI IP Library / CIDR instances
-- @class	module
-- @name	luci.ip.cidr
cidr = luci.util.class()

--- Test whether the instance is a IPv4 address.
-- @return	Boolean indicating a IPv4 address type
-- @see		is6
function cidr.is4( self )
	return self[1] == FAMILY_INET4
end

--- Test whether the instance is a IPv6 address.
-- @return	Boolean indicating a IPv6 address type
-- @see		is4
function cidr.is6( self )
	return self[1] == FAMILY_INET6
end

--- Return a corresponding string representation of the instance.
-- If the prefix length is lower then the maximum possible prefix length for the
-- corresponding address type then the address is returned in CIDR notation,
-- otherwise the prefix will be left out.
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

--- Test whether the value of the instance is lower then the given address.
-- This function will throw an exception if the given address has a different
-- family than this instance.
-- @param addr	A luci.ip.cidr instance to compare against
-- @return		Boolean indicating whether this instance is lower
-- @see			higher
-- @see			equal
function cidr.lower( self, addr )
	assert( self[1] == addr[1], "Can't compare IPv4 and IPv6 addresses" )
	for i = 1, #self[2] do
		if self[2][i] ~= addr[2][i] then
			return self[2][i] < addr[2][i]
		end
	end
	return false
end

--- Test whether the value of the instance is higher then the given address.
-- This function will throw an exception if the given address has a different
-- family than this instance.
-- @param addr	A luci.ip.cidr instance to compare against
-- @return		Boolean indicating whether this instance is higher
-- @see			lower
-- @see			equal
function cidr.higher( self, addr )
	assert( self[1] == addr[1], "Can't compare IPv4 and IPv6 addresses" )
	for i = 1, #self[2] do
		if self[2][i] ~= addr[2][i] then
			return self[2][i] > addr[2][i]
		end
	end
	return false
end

--- Test whether the value of the instance is uequal to the given address.
-- This function will throw an exception if the given address is a different
-- family than this instance.
-- @param addr	A luci.ip.cidr instance to compare against
-- @return		Boolean indicating whether this instance is equal
-- @see			lower
-- @see			higher
function cidr.equal( self, addr )
	assert( self[1] == addr[1], "Can't compare IPv4 and IPv6 addresses" )
	for i = 1, #self[2] do
		if self[2][i] ~= addr[2][i] then
			return false
		end
	end
	return true
end

--- Return the prefix length of this CIDR instance.
-- @return	Prefix length in bit
function cidr.prefix( self, mask )
	local prefix = self[3]

	if mask then
		prefix = 0
		local stop = false
		local obj = self:is4() and IPv4(mask) or IPv6(mask)

		if not obj then
			return nil
		end

		for i, block in ipairs(obj[2]) do
			local pos = bit.lshift(1, 15)
			for i=15, 0, -1 do
				if bit.band(block, pos) == pos then
					if not stop then
						prefix = prefix + 1
					else
						return nil
					end
				else
					stop = true
				end
				pos = bit.rshift(pos, 1)
			end
		end
	end

	return prefix
end

--- Return a corresponding CIDR representing the network address of this
-- instance.
-- @param bits	Override prefix length of this instance (optional)
-- @return		CIDR instance containing the network address
-- @see			host
-- @see			mask
function cidr.network( self, bits )
	local data = { }
	bits = bits or self[3]

	for i = 1, math.floor( bits / 16 ) do
		table.insert( data, self[2][i] )
	end

	if #data < #self[2] then
		table.insert( data, bit.band( self[2][1+#data], __mask16(bits) ) )

		for i = #data + 1, #self[2] do
			table.insert( data, 0 )
		end
	end

	return __bless({ self[1], data, __length(self[1]) })
end

--- Return a corresponding CIDR representing the host address of this
-- instance. This is intended to extract the host address from larger subnet.
-- @return		CIDR instance containing the network address
-- @see			network
-- @see			mask
function cidr.host( self )
	return __bless({ self[1], data, __length(self[1]) })
end

--- Return a corresponding CIDR representing the netmask of this instance.
-- @param bits	Override prefix length of this instance (optional)
-- @return		CIDR instance containing the netmask
-- @see			network
-- @see			host
function cidr.mask( self, bits )
	local data = { }
	bits = bits or self[3]

	for i = 1, math.floor( bits / 16 ) do
		table.insert( data, 0xFFFF )
	end

	if #data < #self[2] then
		table.insert( data, __mask16(bits) )

		for i = #data + 1, #self[2] do
			table.insert( data, 0 )
		end
	end

	return __bless({ self[1], data, __length(self[1]) })
end

--- Test whether this instance fully contains the given CIDR instance.
-- @param addr	CIDR instance to test against
-- @return		Boolean indicating whether this instance contains the given CIDR
function cidr.contains( self, addr )
	assert( self[1] == addr[1], "Can't compare IPv4 and IPv6 addresses" )

	if self:prefix() <= addr:prefix() then
		return self:network() == addr:network(self:prefix())
	end

	return false
end

--- Add specified amount of hosts to this instance.
-- @param amount	Number of hosts to add to this instance
-- @return			CIDR representing the new address or nil on overflow error
-- @see				sub
function cidr.add( self, amount )
	local shorts = { bit.rshift(amount, 16), bit.band(amount, 0xFFFF) }
	local data   = { unpack(self[2]) }

	for pos = #data, 1, -1 do
		local add = ( #shorts > 0 ) and table.remove( shorts, #shorts ) or 0
		if ( data[pos] + add ) > 0xFFFF then
			data[pos] = ( data[pos] + add ) % 0xFFFF
			if pos > 1 then
				data[pos-1] = data[pos-1] + ( add - data[pos] )
			else
				return nil
			end
		else
			data[pos] = data[pos] + add
		end
	end

	return __bless({ self[1], data, self[3] })
end

--- Substract specified amount of hosts from this instance.
-- @param amount	Number of hosts to substract from this instance
-- @return			CIDR representing the new address or nil on underflow error
-- @see				add
function cidr.sub( self, amount )
	local shorts = { bit.rshift(amount, 16), bit.band(amount, 0xFFFF) }
	local data   = { unpack(self[2]) }

	for pos = #data, 1, -1 do
		local sub = ( #shorts > 0 ) and table.remove( shorts, #shorts ) or 0
		if ( data[pos] - sub ) < 0 then
			data[pos] = ( sub - data[pos] ) % 0xFFFF
			if pos > 1 then
				data[pos-1] = data[pos-1] - ( sub + data[pos] )
			else
				return nil
			end
		else
			data[pos] = data[pos] - sub
		end
	end

	return __bless({ self[1], data, self[3] })
end
