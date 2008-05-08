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

require("uci")
require("ffluci.util")
require("ffluci.sys")

-- Session class
Session = ffluci.util.class()

-- Session constructor
function Session.__init__(self, savedir)
	self.ucicmd  = savedir and "uci -P " .. savedir or "uci"
	self.savedir = savedir or ffluci.model.uci.savedir
end

function Session.add(self, config, section_type)
	return self:_uci("add " .. _path(config) .. " " .. _path(section_type))
end

function Session.changes(self, config)
	return self:_uci("changes " .. _path(config))
end

function Session.commit(self, config)
	self:t_load(config)
	return self:t_commit(config)
end

function Session.del(self, config, section, option)
	return self:_uci2("del " .. _path(config, section, option))
end

function Session.get(self, config, section, option)
	self:t_load(config)
	return self:t_get(config, section, option)
end

function Session.revert(self, config)
	self:t_load(config)
	return self:t_revert(config)
end

function Session.sections(self, config)
	self:t_load(config)
	return self:t_sections(config)
end

function Session.set(self, config, section, option, value)
	self:t_load(config)
	return self:t_set(config, section, option, value) and self:t_save(config)
end

function Session.synchronize(self)
	return uci.set_savedir(self.savedir)
end


-- UCI-Transactions

function Session.t_load(self, config)
	return self:synchronize() and uci.load(config)
end

function Session.t_save(self, config)
	return uci.save(config)
end

function Session.t_add(self, config, type)
	self:t_save(config)
	local r = self:add(config, type)
	self:t_load(config)
	return r
end

function Session.t_commit(self, config)
	return uci.commit(config)
end

function Session.t_del(self, config, section, option)
	self:t_save(config)
	local r = self:del(config, section, option)
	self:t_load(config)
	return r
end

function Session.t_get(self, config, section, option)
	if option then
		return uci.get(config, section, option)
	else
		return uci.get(config, section)
	end
end

function Session.t_revert(self, config)
	return uci.revert(config)
end

function Session.t_sections(self, config)
	local raw = uci.get_all(config)
	if not raw then
		return nil
	end
		
	local s = {}
	local o = {}
	
	for i, sec in ipairs(raw) do 
		table.insert(o, sec.name)
		
		s[sec.name] = sec.options
		s[sec.name][".type"] = sec.type
	end
	
	return s, o
end

function Session.t_set(self, config, section, option, value)
	if option then
		return uci.set(config.."."..section.."."..option.."="..value)
	else
		return uci.set(config.."."..section.."="..value)
	end
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