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
require("ffluci.i18n")

-- Default modelpath
modelpath = ffluci.fs.dirname(ffluci.util.__file__()) .. "/model/menu/"

-- Menu definition extra scope
scope = {
	translate = ffluci.i18n.translate
}

-- Local menu database
local menu = {}

-- The current pointer
local menuc = {}

-- Adds a menu category to the current menu and selects it
function add(cat, controller, title, order)
	order = order or 50
	if not menu[cat] then
		menu[cat] = {}
	end
	
	local entry = {}
	entry[".descr"] = title
	entry[".order"] = order
	entry[".contr"] = controller
	
	menuc = entry

	local i = 0			
	for k,v in ipairs(menu[cat]) do
		if v[".order"] > entry[".order"] then
			break
		end  
		i = k
	end	
	table.insert(menu[cat], i+1, entry)
		
	return true
end

-- Adds an action to the current menu
function act(action, title)
	table.insert(menuc, {action = action, descr = title})
	return true
end

-- Selects a menu category
function sel(cat, controller)
	if not menu[cat] then
		return nil
	end
	menuc = menu[cat]
	
	local stat = nil
	for k,v in ipairs(menuc) do
		if v[".contr"] == controller then
			menuc = v
			stat = true
		end
	end
	
	return stat
end


-- Collect all menu information provided in the model dir
function collect()
	for k, menu in pairs(ffluci.fs.dir(modelpath)) do
		if menu:sub(1, 1) ~= "." then
			local f = loadfile(modelpath.."/"..menu)
			local env = ffluci.util.clone(scope)
			
			env.add = add
			env.sel = sel
			env.act = act
			
			setfenv(f, env)
			f()
		end
	end
end

-- Returns the menu information
function get()
	collect()
	return menu
end