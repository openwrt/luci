--[[
FFLuCI - UCI libuci wrapper

Description:
Wrapper for the libuci Lua bindings

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

module("ffluci.model.uci.libuci", package.seeall)

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

function Session.add(self, config, section_type)
	return self:_uci("add " .. _path(config) .. " " .. _path(section_type))
end

function Session.changes(self, config)
	return self:_uci("changes " .. _path(config))
end

function Session.commit(self, config)
	return self:_uci2("commit " .. _path(config))
end

function Session.del(self, config, section, option)
	return self:_uci2("del " .. _path(config, section, option))
end

function Session.get(self, config, section, option)
	return self:_uci("get " .. _path(config, section, option))
end

function Session.revert(self, config)
	return self:_uci2("revert " .. _path(config))
end

function Session.sections(self, config)	
	if not config then
		return nil
	end
	
	local r1, r2 = self:_uci3("show " .. _path(config))
	if type(r1) == "table" then
		return r1[config]
	else
		return nil, r2
	end
end

function Session.set(self, config, section, option, value)
	return self:_uci2("set " .. _path(config, section, option, value))
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

	tbl = {}

	for k,line in pairs(res) do
		c, s, t = line:match("^([^.]-)%.([^.]-)=(.-)$")
		if c then
			tbl[c] = tbl[c] or {}
			tbl[c][".order"] = tbl[c][".order"] or {}
			
			tbl[c][s] = {}
			table.insert(tbl[c][".order"], s)
			tbl[c][s][".type"] = t
		end
	
		c, s, o, v = line:match("^([^.]-)%.([^.]-)%.([^.]-)=(.-)$")
		if c then
			tbl[c][s][o] = v
		end
	end
	
	return tbl
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