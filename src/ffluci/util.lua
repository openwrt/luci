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
function exec(command, return_array)
	local pp   = io.popen(command)
	local data = nil
	
	if return_array then
		local line = ""
		data = {}
		
		while true do
			line = pp:read()
			if (line == nil) then break end
			table.insert(data, line)
		end 
		pp:close()		
	else
		data = pp:read("*a")
		pp:close()
	end
	
	return data
end

-- Populate obj in the scope of f as key 
function extfenv(f, key, obj)
	local scope = getfenv(f)
	scope[key] = obj
	setfenv(f, scope)
end


-- Updates the scope of f with "extscope"
function updfenv(f, extscope)
	local scope = getfenv(f)
	for k, v in pairs(extscope) do
		scope[k] = v
	end
	setfenv(f, scope)
end

-- Returns the filename of the calling script
function __file__()
	return debug.getinfo(2, 'S').source:sub(2)
end