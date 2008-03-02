--[[
FFLuCI - UCI wrapper library

Description:
Wrapper for the /sbin/uci application, syntax of implemented functions
is comparable to the syntax of the uci application

Any return value of false or nil can be interpreted as an error

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
module("ffluci.model.uci", package.seeall)
require("ffluci.util")

ucicmd = "uci"

-- Wrapper for "uci add"
function add(config, section_type)
	return _uci("add " .. _path(config) .. " " .. _path(section_type))
end


-- Wrapper for "uci changes"
function changes(config)
	return _uci3("changes " .. _path(config))
end


-- Wrapper for "uci commit"
function commit(config)
	return _uci2("commit " .. _path(config))
end


-- Wrapper for "uci get"
function get(config, section, option)
	return _uci("get " .. _path(config, section, option))
end


-- Wrapper for "uci revert"
function revert(config)
	return _uci2("revert " .. _path(config))
end


-- Wrapper for "uci show"
function show(config)
	return _uci3("show " .. _path(config))
end


-- Wrapper for "uci set"
function set(config, section, option, value)
	return _uci2("set " .. _path(config, section, option, value))
end


-- Internal functions --

function _uci(cmd)
	local res = ffluci.util.exec(ucicmd .. " 2>/dev/null " .. cmd)
	
	if res:len() == 0 then
		return nil
	else
		return res:sub(1, res:len()-1)
	end	
end

function _uci2(cmd)
	local res = ffluci.util.exec(ucicmd .. " 2>&1 " .. cmd)
	
	if res:len() > 0 then
		return false, res
	else
		return true
	end	
end

function _uci3(cmd)
	local res = ffluci.util.exec(ucicmd .. " 2>&1 " .. cmd, true)
	if res[1]:sub(1, ucicmd:len() + 1) == ucicmd .. ":" then
		return nil, res[1]
	end

	table = {}
	
	for k,line in pairs(res) do
		c, s, t = line:match("^([^.]-)%.([^.]-)=(.-)$")
		if c then
			table[c] = table[c] or {}
			table[c][s] = {}
			table[c][s][".type"] = t
		end
	
		c, s, o, v = line:match("^([^.]-)%.([^.]-)%.([^.]-)=(.-)$")
		if c then
			table[c][s][o] = v
		end
	end
	
	return table
end

-- Build path (config.section.option=value) and prevent command injection
function _path(...)
	local result = ""
	
	-- Not using ipairs because it is not reliable in case of nil arguments
	arg.n = nil
	for k,v in pairs(arg) do
		if k == 1 then
			result = "'" .. v:gsub("['.]", "") .. "'"
		elseif k < 4 then
			result = result .. ".'" .. v:gsub("['.]", "") .. "'"
		elseif k == 4 then
			result = result .. "='" .. v:gsub("'", "") .. "'"
		end
	end
	return result
end