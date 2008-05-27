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

--]]

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

--]]

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

--[[
local dec2hex = {
	["0"] = "0",
	["1"] = "1",
	["2"] = "2",
	["3"] = "3",
	["4"] = "4",
	["5"] = "5",
	["6"] = "6",
	["7"] = "7",
	["8"] = "8",
	["9"] = "9",
	["10"] = "A",
	["11"] = "B",
	["12"] = "C",
	["13"] = "D",
	["14"] = "E",
	["15"] = "F"
	}
--]]


-- These functions are big-endian and take up to 32 bits

-- Hex2Bin
-- Bin2Hex
-- Hex2Dec
-- Dec2Hex
-- Bin2Dec
-- Dec2Bin


function Hex2Bin(s)

-- s	-> hexadecimal string

local ret = ""
local i = 0


	for i in string.gfind(s, ".") do
		i = string.lower(i)

		ret = ret..hex2bin[i]

	end

	return ret
end


function Bin2Hex(s)

-- s 	-> binary string

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


function Bin2Dec(s)

-- s	-> binary string

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



function Dec2Bin(s, num)

-- s	-> Base10 string
-- num  -> string length to extend to

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




function Hex2Dec(s)

-- s	-> hexadecimal string

local s = Hex2Bin(s)

	return Bin2Dec(s)

end



function Dec2Hex(s)

-- s	-> Base10 string

	s = string.format("%x", s)

	return s

end




-- These functions are big-endian and will extend to 32 bits

-- BMAnd
-- BMNAnd
-- BMOr
-- BMXOr
-- BMNot


function BMAnd(v, m)

-- v	-> hex string to be masked
-- m	-> hex string mask

-- s	-> hex string as masked

-- bv	-> binary string of v
-- bm	-> binary string mask

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


function BMNAnd(v, m)

-- v	-> hex string to be masked
-- m	-> hex string mask

-- s	-> hex string as masked

-- bv	-> binary string of v
-- bm	-> binary string mask

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



function BMOr(v, m)

-- v	-> hex string to be masked
-- m	-> hex string mask

-- s	-> hex string as masked

-- bv	-> binary string of v
-- bm	-> binary string mask

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

function BMXOr(v, m)

-- v	-> hex string to be masked
-- m	-> hex string mask

-- s	-> hex string as masked

-- bv	-> binary string of v
-- bm	-> binary string mask

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


function BMNot(v, m)

-- v	-> hex string to be masked
-- m	-> hex string mask

-- s	-> hex string as masked

-- bv	-> binary string of v
-- bm	-> binary string mask

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


-- these functions shift right and left, adding zeros to lost or gained bits
-- returned values are 32 bits long

-- BShRight(v, nb)
-- BShLeft(v, nb)


function BShRight(v, nb)

-- v	-> hexstring value to be shifted
-- nb	-> number of bits to shift to the right

-- s	-> binary string of v

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

function BShLeft(v, nb)

-- v	-> hexstring value to be shifted
-- nb	-> number of bits to shift to the right

-- s	-> binary string of v

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