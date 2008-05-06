--[[
FFLuCI - Utility library

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

module("ffluci.util", package.seeall)


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


-- Checks whether a table has an object "value" in it
function contains(table, value)
	for k,v in pairs(table) do
		if value == v then
			return true
		end
	end
	return false
end


-- Dumps a table to stdout (useful for testing and debugging)
function dumptable(t, i)
	i = i or 0
	for k,v in pairs(t) do
		print(string.rep("\t", i) .. k, v)
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

-- Removes whitespace from beginning and end of a string
function trim(string)
	local s = string:gsub("^%s*(.-)%s*$", "%1")
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