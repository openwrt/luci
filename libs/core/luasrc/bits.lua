--[[
/*
 * Copyright (c) 2007 Tim Kelly/Dialectronics
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the
 * "Software"),  to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to permit
 * persons to whom the Software is furnished to do so, subject to the
 * following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT
 * OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR
 * THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

	Modifications and documentation for LuCI made by
		Steven Barth <steven@midlink.org> and
		Jo-Philipp Wich <xm@leipzig.freifunk.net>

--]]

--- LuCI number conversation and bit manipulation functions.
module("luci.bits", package.seeall);

local hex2bin = {
	["0"] = "0000",
	["1"] = "0001",
	["2"] = "0010",
	["3"] = "0011",
	["4"] = "0100",
	["5"] = "0101",
	["6"] = "0110",
	["7"] = "0111",
	["8"] = "1000",
	["9"] = "1001",
	["a"] = "1010",
    ["b"] = "1011",
    ["c"] = "1100",
    ["d"] = "1101",
    ["e"] = "1110",
    ["f"] = "1111"
}

local bin2hex = {
	["0000"] = "0",
	["0001"] = "1",
	["0010"] = "2",
	["0011"] = "3",
	["0100"] = "4",
	["0101"] = "5",
	["0110"] = "6",
	["0111"] = "7",
	["1000"] = "8",
	["1001"] = "9",
	["1010"] = "A",
    ["1011"] = "B",
    ["1100"] = "C",
    ["1101"] = "D",
    ["1110"] = "E",
    ["1111"] = "F"
}

--- Convert hexadecimal to binary number.
-- This function is big endian and can take up to 32 bits.
-- @param s	String containing hex value
-- @return	String containing binary value
function Hex2Bin(s)

	local ret = ""
	local i = 0


	for i in string.gfind(s, ".") do
		i = string.lower(i)

		ret = ret..hex2bin[i]

	end

	return ret
end

--- Convert binary to hexadecimal number.
-- This function is big endian and can take up to 32 bits.
-- @param s	String containing binary value
-- @return	String containing hex value
function Bin2Hex(s)

	local l = 0
	local h = ""
	local b = ""
	local rem

	l = string.len(s)
	rem = l % 4
	l = l-1
	h = ""

	-- need to prepend zeros to eliminate mod 4
	if (rem > 0) then
		s = string.rep("0", 4 - rem)..s
	end

	for i = 1, l, 4 do
		b = string.sub(s, i, i+3)
		h = h..bin2hex[b]
	end

	return h

end

--- Convert binary to decimal number.
-- This function is big endian and can take up to 32 bits.
-- @param s	String containing binary value
-- @return	String containing decimal value
function Bin2Dec(s)

	local num = 0
	local ex = string.len(s) - 1
	local l = 0

	l = ex + 1
	for i = 1, l do
		b = string.sub(s, i, i)
		if b == "1" then
			num = num + 2^ex
		end
		ex = ex - 1
	end

	return string.format("%u", num)

end

--- Convert decimal to binary number.
-- This function is big endian and can take up to 32 bits.
-- @param s		String or number containing decimal value
-- @param num	Pad binary number to num bits
-- @return		String containing binary value
function Dec2Bin(s, num)

	local n

	if (num == nil) then
		n = 0
	else
		n = num
	end

	s = string.format("%x", s)

	s = Hex2Bin(s)

	while string.len(s) < n do
		s = "0"..s
	end

	return s

end

--- Convert hexadecimal to decimal number.
-- This function is big endian and can take up to 32 bits.
-- @param s	String containing hex value
-- @return	String containing decimal value
function Hex2Dec(s)

	local s = Hex2Bin(s)

	return Bin2Dec(s)

end

--- Convert decimal to hexadecimal number.
-- This function is big endian and can take up to 32 bits.
-- @param s	String containing decimal value
-- @return	String containing hex value
function Dec2Hex(s)

	s = string.format("%x", s)

	return s

end


--- Apply bitmask to value using bitwise And.
-- This function is big endian and will extend the values to 32 bits.
-- @param v	String containing hex value to be masked
-- @param m	String containing hex value of mask
-- @return	String containing hex value of masked value
function BMAnd(v, m)

	local bv = Hex2Bin(v)
	local bm = Hex2Bin(m)

	local i = 0
	local s = ""

	while (string.len(bv) < 32) do
		bv = "0000"..bv
	end

	while (string.len(bm) < 32) do
		bm = "0000"..bm
	end


	for i = 1, 32 do
		cv = string.sub(bv, i, i)
		cm = string.sub(bm, i, i)
		if cv == cm then
			if cv == "1" then
				s = s.."1"
			else
				s = s.."0"
			end
		else
			s = s.."0"

		end
	end

	return Bin2Hex(s)

end

--- Apply bitmask to value using bitwise Nand.
-- This function is big endian and will extend the values to 32 bits.
-- @param v	String containing hex value to be masked
-- @param m	String containing hex value of mask
-- @return	String containing hex value of masked value
function BMNAnd(v, m)

	local bv = Hex2Bin(v)
	local bm = Hex2Bin(m)

	local i = 0
	local s = ""

	while (string.len(bv) < 32) do
		bv = "0000"..bv
	end

	while (string.len(bm) < 32) do
		bm = "0000"..bm
	end


	for i = 1, 32 do
		cv = string.sub(bv, i, i)
		cm = string.sub(bm, i, i)
		if cv == cm then
			if cv == "1" then
				s = s.."0"
			else
				s = s.."1"
			end
		else
			s = s.."1"

		end
	end

	return Bin2Hex(s)

end

--- Apply bitmask to value using bitwise Or.
-- This function is big endian and will extend the values to 32 bits.
-- @param v	String containing hex value to be masked
-- @param m	String containing hex value of mask
-- @return	String containing hex value of masked value
function BMOr(v, m)

	local bv = Hex2Bin(v)
	local bm = Hex2Bin(m)

	local i = 0
	local s = ""

	while (string.len(bv) < 32) do
		bv = "0000"..bv
	end

	while (string.len(bm) < 32) do
		bm = "0000"..bm
	end


	for i = 1, 32 do
		cv = string.sub(bv, i, i)
		cm = string.sub(bm, i, i)
		if cv == "1" then
				s = s.."1"
		elseif cm == "1" then
				s = s.."1"
		else
			s = s.."0"
		end
	end

	return Bin2Hex(s)

end

--- Apply bitmask to value using bitwise Xor.
-- This function is big endian and will extend the values to 32 bits.
-- @param v	String containing hex value to be masked
-- @param m	String containing hex value of mask
-- @return	String containing hex value of masked value
function BMXOr(v, m)

	local bv = Hex2Bin(v)
	local bm = Hex2Bin(m)

	local i = 0
	local s = ""

	while (string.len(bv) < 32) do
		bv = "0000"..bv
	end

	while (string.len(bm) < 32) do
		bm = "0000"..bm
	end


	for i = 1, 32 do
		cv = string.sub(bv, i, i)
		cm = string.sub(bm, i, i)
		if cv == "1" then
			if cm == "0" then
				s = s.."1"
			else
				s = s.."0"
			end
		elseif cm == "1" then
			if cv == "0" then
				s = s.."1"
			else
				s = s.."0"
			end
		else
			-- cv and cm == "0"
			s = s.."0"
		end
	end

	return Bin2Hex(s)

end

--- Apply bitmask to value using bitwise Not.
-- This function is big endian and will extend the values to 32 bits.
-- @param v	String containing hex value to be masked
-- @param m	String containing hex value of mask
-- @return	String containing hex value of masked value
function BMNot(v, m)

	local bv = Hex2Bin(v)
	local bm = Hex2Bin(m)

	local i = 0
	local s = ""

	while (string.len(bv) < 32) do
		bv = "0000"..bv
	end

	while (string.len(bm) < 32) do
		bm = "0000"..bm
	end


	for i = 1, 32 do
		cv = string.sub(bv, i, i)
		cm = string.sub(bm, i, i)
		if cm == "1" then
			if cv == "1" then
				-- turn off
				s = s.."0"
			else
				-- turn on
				s = s.."1"
			end
		else
			-- leave untouched
			s = s..cv

		end
	end

	return Bin2Hex(s)

end


--- Perform righthand bit shifting on value.
-- This function pads the shifted value with zeroes and will extend to 32 bits.
-- @param v		String containing hex value to be shifted
-- @param nb	Number of bits to shift right
-- @return		String containing hex value of shifted value
function BShRight(v, nb)

	local s = Hex2Bin(v)

	while (string.len(s) < 32) do
		s = "0000"..s
	end

	s = string.sub(s, 1, 32 - nb)

	while (string.len(s) < 32) do
		s = "0"..s
	end

	return Bin2Hex(s)

end

--- Perform lefthand bit shifting on value.
-- This function pads the shifted value with zeroes and extend to 32 bits.
-- @param v		String containing hex value to be shifted
-- @param nb	Number of bits to shift left
-- @return		String containing hex value of shifted value
function BShLeft(v, nb)

	local s = Hex2Bin(v)

	while (string.len(s) < 32) do
		s = "0000"..s
	end

	s = string.sub(s, nb + 1, 32)

	while (string.len(s) < 32) do
		s = s.."0"
	end

	return Bin2Hex(s)

end
