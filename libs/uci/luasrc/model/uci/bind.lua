--[[
LuCI - UCI utilities for model classes

Copyright 2009 Jo-Philipp Wich <xm@subsignal.org>

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

local assert, pairs, type = assert, pairs, type
local utl = require "luci.util"

module "luci.model.uci.bind"

bind = utl.class()

function bind.__init__(self, config, cursor)
	assert(config, "call to bind() without config file")
	self.cfg = config
	self.uci = cursor
end

function bind.init(self, cursor)
	assert(cursor, "call to init() without uci cursor")
	self.uci = cursor
end

function bind.section(self, stype)
	local x = utl.class(bsection)
	x.__init__ = function(inst, sid)
		assert(self.uci:get(self.cfg, sid) == stype,
			"attempt to instantiate bsection(%q) of wrong type, expected %q"
			% { sid, stype })

		inst.bind  = self
		inst.stype = stype
		inst.sid   = sid
	end
	return x
end

function bind.usection(self, stype)
	local x = utl.class(bsection)
	x.__init__ = function(inst)
		inst.bind  = self
		inst.stype = stype
		inst.sid   = true
	end
	return x()
end

function bind.list(self, list, add, rem)
	local lookup = { }

	if type(list) == "string" then
		local item
		for item in list:gmatch("%S+") do
			lookup[item] = true
		end

	elseif type(list) == "table" then
		local item
		for _, item in pairs(list) do
			lookup[item] = true
		end
	end

	if add then lookup[add] = true end
	if rem then lookup[rem] = nil  end

	return utl.keys(lookup)
end

function bind.bool(self, v)
	return ( v == "1" or v == "true" or v == "yes" or v == "on" )
end


bsection = utl.class()

function bsection.uciop(self, op, ...)
	assert(self.bind and self.bind.uci,
		"attempt to use unitialized binding")

	if op then
		return self.bind.uci[op](self.bind.uci, self.bind.cfg, ...)
	else
		return self.bind.uci
	end
end

function bsection.get(self, k, c)
	local v
	if type(c) == "string" then
		v = self:uciop("get", c, k)
	else
		self:uciop("foreach", self.stype,
			function(s)
				if type(c) == "table" then
					local ck, cv
					for ck, cv in pairs(c) do
						if s[ck] ~= cv then return true end
					end
				end
				if k ~= nil then
					v = s[k]
				else
					v = s
				end
				return false
			end)
	end
	return v
end

function bsection.set(self, k, v, c)
	local stat
	if type(c) == "string" then
		stat = self:uciop("set", c, k, v)
	else
		self:uciop("foreach", self.stype,
			function(s)
				if type(c) == "table" then
					local ck, cv
					for ck, cv in pairs(c) do
						if s[ck] ~= cv then return true end
					end
				end
				stat = self:uciop("set", c, k, v)
				return false
			end)
	end
	return stat or false
end

function bsection.property(self, k, n)
	self[n or k] = function(c, val)
		if val == nil then
			return c:get(k, c.sid)
		else
			return c:set(k, val, c.sid)
		end
	end
end

function bsection.property_bool(self, k, n)
	self[n or k] = function(c, val)
		if val == nil then
			return self.bind:bool(c:get(k, c.sid))
		else
			return c:set(k, self.bind:bool(val) and "1" or "0", c.sid)
		end
	end
end

