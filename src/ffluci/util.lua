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
			inst:__init__(...)
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


-- Runs "command" and returns its output
function exec(command)
	local pp   = io.popen(command)
	local data = pp:read("*a")
	pp:close()
	
	return data
end


-- Runs "command" and returns its output as a array of lines
function execl(command)
	local pp   = io.popen(command)	
	local line = ""
	local data = {}
	
	while true do
		line = pp:read()
		if (line == nil) then break end
		table.insert(data, line)
	end 
	pp:close()	
	
	return data
end


-- Populate obj in the scope of f as key 
function extfenv(f, key, obj)
	local scope = getfenv(f)
	scope[key] = obj
	setfenv(f, scope)
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


-- Updates the scope of f with "extscope"
function updfenv(f, extscope)
	local scope = getfenv(f)
	for k, v in pairs(extscope) do
		scope[k] = v
	end
	setfenv(f, scope)
end


-- Validates a variable
function validate(value, cast_number, cast_int, valid)
	if cast_number or cast_int then
		value = tonumber(value)
	end
	
	if cast_int and not(value % 1 == 0) then
		value = nil
	end
	
	
	if type(valid) == "function" then
		value = valid(value)
	elseif type(valid) == "table" then
		if not ffluci.util.contains(valid, value) then
			value = nil
		end
	end
	
	return value
end


-- Returns the filename of the calling script
function __file__()
	return debug.getinfo(2, 'S').source:sub(2)
end