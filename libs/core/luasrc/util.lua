--[[
LuCI - Utility library

Description:
Several common useful Lua functions

FileId:
$Id$

License:
Copyright 2008 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at 

	http://www.apache.org/licenses/LICENSE-2.0 

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

]]--

module("luci.util", package.seeall)


-- Lua simplified Python-style OO class support emulation
function class(base)
	local class = {}
	
	local create = function(class, ...)
		local inst = {}
		setmetatable(inst, {__index = class})
		
		if inst.__init__ then
			local stat, err = pcall(inst.__init__, inst, ...)
			if not stat then
				error(err)
			end
		end
		
		return inst
	end
	
	local classmeta = {__call = create}
	
	if base then
		classmeta.__index = base
	end
	
	setmetatable(class, classmeta)
	return class
end


-- Clones an object (deep on-demand)
function clone(object, deep)
	local copy = {}
	
	for k, v in pairs(object) do
		if deep and type(v) == "table" then
			v = clone(v, deep)
		end
		copy[k] = v
	end
	
	setmetatable(copy, getmetatable(object))
	
	return copy
end


-- Combines two or more numerically indexed tables into one
function combine(...)
	local result = {}
	for i, a in ipairs(arg) do
		for j, v in ipairs(a) do
			table.insert(result, v)
		end
	end
	return result
end


-- Checks whether a table has an object "value" in it
function contains(table, value)
	for k,v in pairs(table) do
		if value == v then
			return true
		end
	end
	return false
end


-- Dumps and strips a Lua-Function
function dump(f)
	local d = string.dump(f)
	return d and strip_bytecode(d)
end


-- Dumps a table to stdout (useful for testing and debugging)
function dumptable(t, i)
	i = i or 0
	for k,v in pairs(t) do
		print(string.rep("\t", i) .. tostring(k), tostring(v))
		if type(v) == "table" then
			dumptable(v, i+1)
		end
	end
end


-- Escapes all occurences of c in s
function escape(s, c)
	c = c or "\\"
	return s:gsub(c, "\\" .. c)
end


-- Populate obj in the scope of f as key 
function extfenv(f, key, obj)
	local scope = getfenv(f)
	scope[key] = obj
end


-- Checks whether an object is an instanceof class
function instanceof(object, class)
	local meta = getmetatable(object)
    while meta and meta.__index do 
    	if meta.__index == class then
    		return true
    	end
        meta = getmetatable(meta.__index)
    end
    return false	
end


-- Creates valid XML PCDATA from a string
function pcdata(value)
	value = value:gsub("&", "&amp;")	
	value = value:gsub('"', "&quot;")
	value = value:gsub("'", "&apos;")
	value = value:gsub("<", "&lt;")	
	return value:gsub(">", "&gt;")
end


-- Resets the scope of f doing a shallow copy of its scope into a new table
function resfenv(f)
	setfenv(f, clone(getfenv(f)))
end 


-- Splits a string into an array
function split(str, pat, max, regex)
	pat = pat or "\n"
	max = max or #str
	
	local t = {}
	local c = 1
	
	if #str == 0 then
		return {""}
	end
	
	if #pat == 0 then
		return nil
	end
	
	if max == 0 then
		return str
	end
	
	repeat
		local s, e = str:find(pat, c, not regex)
		table.insert(t, str:sub(c, s and s - 1))
		max = max - 1
		c = e and e + 1 or #str + 1
	until not s or max < 0
	
	return t
end


-- Strips lua bytecode
-- Original version by Peter Cawley (http://lua-users.org/lists/lua-l/2008-02/msg01158.html)
function strip_bytecode(dump)
	local version, format, endian, int, size, ins, num, lnum = dump:byte(5, 12)
	local subint
	if endian == 1 then
		subint = function(dump, i, l)
			local val = 0
			for n = l, 1, -1 do
				val = val * 256 + dump:byte(i + n - 1)
			end
			return val, i + l
		end
	else
		subint = function(dump, i, l)
			local val = 0
			for n = 1, l, 1 do
				val = val * 256 + dump:byte(i + n - 1)
			end
			return val, i + l
		end
	end
    
	local strip_function
	strip_function = function(dump)
		local count, offset = subint(dump, 1, size)
		local stripped, dirty = string.rep("\0", size), offset + count
		offset = offset + count + int * 2 + 4
		offset = offset + int + subint(dump, offset, int) * ins
		count, offset = subint(dump, offset, int)
		for n = 1, count do
			local t
			t, offset = subint(dump, offset, 1)
			if t == 1 then
				offset = offset + 1
			elseif t == 4 then
				offset = offset + size + subint(dump, offset, size)
			elseif t == 3 then
				offset = offset + num
			elseif t == 254 then
				offset = offset + lnum
			end
		end
		count, offset = subint(dump, offset, int)
		stripped = stripped .. dump:sub(dirty, offset - 1)
		for n = 1, count do
			local proto, off = strip_function(dump:sub(offset, -1))
			stripped, offset = stripped .. proto, offset + off - 1
		end
		offset = offset + subint(dump, offset, int) * int + int
		count, offset = subint(dump, offset, int)
		for n = 1, count do
			offset = offset + subint(dump, offset, size) + size + int * 2
		end
		count, offset = subint(dump, offset, int)
		for n = 1, count do
			offset = offset + subint(dump, offset, size) + size
		end
		stripped = stripped .. string.rep("\0", int * 3)
		return stripped, offset
	end
	
	return dump:sub(1,12) .. strip_function(dump:sub(13,-1))
end


-- Removes whitespace from beginning and end of a string
function trim(str)
	local s = str:gsub("^%s*(.-)%s*$", "%1")
	return s
end


-- Updates given table with new values
function update(t, updates)
	for k, v in pairs(updates) do
		t[k] = v
	end	
end


-- Updates the scope of f with "extscope"
function updfenv(f, extscope)
	update(getfenv(f), extscope)
end


-- Validates a variable
function validate(value, cast_number, cast_int)
	if cast_number or cast_int then
		value = tonumber(value)
	end
	
	if cast_int and value and not(value % 1 == 0) then
		value = nil
	end
	
	return value
end


-- Parse units from a string and return integer value
function parse_units(ustr)

        local val = 0

        -- unit map
        local map = {
                -- date stuff
                y   = 60 * 60 * 24 * 366,
                m   = 60 * 60 * 24 * 31,
                w   = 60 * 60 * 24 * 7,
                d   = 60 * 60 * 24,
                h   = 60 * 60,
		min = 60,

                -- storage sizes
                kb  = 1024,
                mb  = 1024 * 1024,
                gb  = 1024 * 1024 * 1024,

                -- storage sizes (si)
                kib = 1000,
                mib = 1000 * 1000,
                gib = 1000 * 1000 * 1000
        }

        -- parse input string
        for spec in ustr:lower():gmatch("[0-9%.]+[a-zA-Z]*") do

                local num = spec:gsub("[^0-9%.]+$","")
                local spn = spec:gsub("^[0-9%.]+", "")

                if map[spn] or map[spn:sub(1,1)] then
                        val = val + num * ( map[spn] or map[spn:sub(1,1)] )
                else
                        val = val + num
                end
        end


	return val
end
