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
local setmetatable, rawget, rawset = setmetatable, rawget, rawset
local error, pairs, ipairs, tostring = error, pairs, ipairs, tostring

module("luci.model.uci", function(m) setmetatable(m, {__index = uci}) end)

savedir_default = "/tmp/.uci"
confdir_default = "/etc/config"

savedir_state = "/var/state"

function delete_all(config, type, comparator)
	local del = {}
	
	foreach(config, type,
		function (section)
			if not comparator or comparator(section) then
				table.insert(del, section[".name"])
			end
		end)
		
	for i, j in ipairs(del) do
		uci.delete(config, j)
	end
end

function section(config, type, name, values)
	local stat = true
	if name then
		stat = set(config, name, type)
	else
		name = add(config, type)
		stat = name and true
	end
	
	if stat and values then
		stat = tset(config, name, values)
	end
	
	return stat and name
end

function tset(config, section, values)
	local stat = true
	for k, v in pairs(values) do
		if k:sub(1, 1) ~= "." then
			stat = stat and set(config, section, k, v)
		end
	end
end
