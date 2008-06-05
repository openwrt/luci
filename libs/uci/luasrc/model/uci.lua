--[[
LuCI - UCI mpdel

Description:
Generalized UCI model

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
local uci  = require("uci")
local util = require("luci.util")
local setmetatable = setmetatable
local rawget = rawget
local rawset = rawset
local error = error
local tostring = tostring

module("luci.model.uci", function(m) setmetatable(m, {__index = uci}) end)

local configs_mt = {}
local sections_mt = {}
local options_mt = {}

config = {}
setmetatable(config, configs_mt)

-- Level 1 (configs)
function configs_mt.__index(self, key)
	local node = rawget(self, key)
	if not node then
		node = {}
		node[".name"] = key
		setmetatable(node, sections_mt)
		rawset(self, key, node)
	end
	return node
end
function configs_mt.__newindex()
	error("invalid operation")
end


-- Level 2 (sections)
function sections_mt.__index(self, key)
	local node = rawget(self, key)
	if not node then
		node = {}
		node[".conf"] = self[".name"]
		node[".name"] = key
		node[".type"] = uci.get(self[".name"], key)
		setmetatable(node, options_mt)
		rawset(self, key, node)
	end
	return node
end
function sections_mt.__newindex(self, key, value)
	if not value then
		if uci.delete(self[".name"], key) then
			rawset(self, key, nil)
		else
			error("unable to delete section")
		end
	elseif key == "" then
		key = uci.add(self[".name"], tostring(value))
		if key then
			rawset(self, "", self[key])
		else
			error("unable to create section")
		end 
	else
		if not uci.set(self[".name"], key, value) then
			error("unable to create section")
		end
	end
end


-- Level 3 (options)
function options_mt.__index(self, key)
	return uci.get(self[".conf"], self[".name"], key)
end
function options_mt.__newindex(self, key, value)
	if not value then
		if not uci.delete(self[".conf"], self[".name"], key) then
			error("unable to delete option")
		end
	else
		if not uci.set(self[".conf"], self[".name"], key, tostring(value)) then
			error("unable to write option")
		end
	end
end
