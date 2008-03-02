--[[
FFLuCI - Menu Builder

Description:
Collects menu building information from controllers

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
module("ffluci.menu", package.seeall)

require("ffluci.fs")
require("ffluci.util")
require("ffluci.template")

ctrldir   = ffluci.fs.dirname(ffluci.util.__file__()) .. "controller/"
modelpath = ffluci.fs.dirname(ffluci.util.__file__()) .. "model/menudata.lua"

-- Cache menudata into a Luafile instead of recollecting it at every pageload
-- Warning: Make sure the menudata cache gets deleted everytime you update
-- the menu information of any module or add or remove a module
builder_enable_cache = false


-- Builds the menudata file
function build()
	local data = collect()
	ffluci.fs.writefile(modelpath, dump(data, "m"))
	return data
end


-- Collect all menu information provided in the controller modules
function collect()
	local m = {}
	for k,cat in pairs(ffluci.fs.dir(ctrldir)) do
		m[cat] = {}
		for k,con in pairs(ffluci.fs.dir(ctrldir .. "/" .. cat)) do
			if con:sub(-4) == ".lua" then
				con = con:sub(1, con:len()-4)
				local mod = require("ffluci.controller." .. cat .. "." .. con)
				if mod.menu and mod.menu.descr
				and mod.menu.entries and mod.menu.order then
					local entry = {}
					entry[".descr"] = mod.menu.descr
					entry[".order"] = mod.menu.order
					entry[".contr"] = con
					for k,v in pairs(mod.menu.entries) do
						entry[k] = v
					end
					local i = 0			
					for k,v in ipairs(m[cat]) do
						if v[".order"] > entry[".order"] then
							break
						end  
						i = k
					end	
					table.insert(m[cat], i+1, entry)
				end
			end
		end
	end
	return m
end


-- Dumps a table into a string of Lua code
function dump(tbl, name)
	local src = name .. "={}\n"
	for k,v in pairs(tbl) do
		if type(k) == "string" then
			k = ffluci.util.escape(k)
			k = "'" .. ffluci.util.escape(k, "'") .. "'"
		end		
		if type(v) == "string" then
			v = ffluci.util.escape(v)
			v = ffluci.util.escape(v, "'")
			src = src .. name .. "[" .. k .. "]='" .. v .. "'\n"
		elseif type(v) == "number" then
			src = src .. name .. "[" .. k .. "]=" .. v .. "\n"
		elseif type(v) == "table" then
			src = src .. dump(v, name .. "[" .. k .. "]")
		end
	end
	return src
end

-- Returns the menu information
function get()
	if builder_enable_cache then
		local cachemt = ffluci.fs.mtime(modelpath)
		local data = nil
		
		if cachemt == nil then
			data = build()
		else
			local fenv = {}
			local f    = loadfile(modelpath)
			setfenv(f, fenv)
			f()
			data = fenv.m
		end
		
		return data
	else
		return collect()
	end
end