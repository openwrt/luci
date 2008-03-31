--[[
FFLuCI - UCI wrapper library

Description:
Wrapper for the /sbin/uci application, syntax of implemented functions
is comparable to the syntax of the uci application

Any return value of false or nil can be interpreted as an error


ToDo: Reimplement in Lua

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
require("ffluci.fs")
require("ffluci.sys")

-- The OS uci command
ucicmd = "uci"

-- Session class
Session = ffluci.util.class()

-- Session constructor
function Session.__init__(self, path, uci)
	uci = uci or ucicmd
	if path then
		self.ucicmd = uci .. " -P " .. path 
	else
		self.ucicmd = uci
	end
end

-- The default Session
local default = Session()

-- Wrapper for "uci add"
function Session.add(self, config, section_type)
	return self:_uci("add " .. _path(config) .. " " .. _path(section_type))
end

function add(...)
	return default:add(...)
end


-- Wrapper for "uci changes"
function Session.changes(self, config)
	return self:_uci("changes " .. _path(config))
end

function changes(...)
	return default:changes(...)
end


-- Wrapper for "uci commit"
function Session.commit(self, config)
	return self:_uci2("commit " .. _path(config))
end

function commit(...)
	return default:commit(...)
end


-- Wrapper for "uci del"
function Session.del(self, config, section, option)
	return self:_uci2("del " .. _path(config, section, option))
end

function del(...)
	return default:del(...)
end


-- Wrapper for "uci get"
function Session.get(self, config, section, option)
	return self:_uci("get " .. _path(config, section, option))
end

function get(...)
	return default:get(...)
end


-- Wrapper for "uci revert"
function Session.revert(self, config)
	return self:_uci2("revert " .. _path(config))
end

function revert(...)
	return default:revert(...)
end


-- Wrapper for "uci show"
function Session.show(self, config)
	return self:_uci3("show " .. _path(config))
end

function show(...)
	return default:show(...)
end


-- Wrapper for "uci set"
function Session.set(self, config, section, option, value)
	return self:_uci2("set " .. _path(config, section, option, value))
end

function set(...)
	return default:set(...)
end


-- Internal functions --

function Session._uci(self, cmd)
	local res = ffluci.sys.exec(self.ucicmd .. " 2>/dev/null " .. cmd)
	
	if res:len() == 0 then
		return nil
	else
		return res:sub(1, res:len()-1)
	end	
end

function Session._uci2(self, cmd)
	local res = ffluci.sys.exec(self.ucicmd .. " 2>&1 " .. cmd)
	
	if res:len() > 0 then
		return false, res
	else
		return true
	end	
end

function Session._uci3(self, cmd)
	local res = ffluci.sys.execl(self.ucicmd .. " 2>&1 " .. cmd)
	if res[1] and res[1]:sub(1, self.ucicmd:len()+1) == self.ucicmd..":" then
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
		if v then
			v = tostring(v)
			if k == 1 then
				result = "'" .. v:gsub("['.]", "") .. "'"
			elseif k < 4 then
				result = result .. ".'" .. v:gsub("['.]", "") .. "'"
			elseif k == 4 then
				result = result .. "='" .. v:gsub("'", "") .. "'"
			end
		end
	end
	return result
end