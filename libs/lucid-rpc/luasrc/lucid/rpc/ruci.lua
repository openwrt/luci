--[[
LuCIRPCd
(c) 2009 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--
local uci = require "luci.model.uci"
local tostring, getmetatable, pairs = tostring, getmetatable, pairs
local error, type = error, type
local nixio = require "nixio"
local srv = require "luci.lucid.rpc.server"

--- Remote UCI functions.
module "luci.lucid.rpc.ruci"

-- Prepare the remote UCI functions.
function _factory()
	local m = srv.Module("Remote UCI API")
	
	for k, v in pairs(_M) do
		if type(v) == "function" and v ~= _factory then
			m:add(k, srv.Method.extended(v))
		end
	end
	
	return m
end

-- Get the associate RUCI instance.
local function getinst(session, name)
	return session.ruci and session.ruci[name]
end

-- Set a new RUCI instance.
local function setinst(session, obj)
	session.ruci = session.ruci or {}
	local name = tostring(obj):match("0x([a-z0-9]+)")
	session.ruci[name] = obj
	return name
end


local Cursor = getmetatable(uci.cursor())

for name, func in pairs(Cursor) do
	_M[name] = function(session, inst, ...)
		inst = getinst(session, inst)
		return inst[name](inst, ...)
	end
end

--- Generate a new RUCI cursor.
-- @param session Session object
-- @param ... Parameters passed to the UCI constructor
-- @return RUCI instance
function cursor(session, ...)
	return setinst(session, uci.cursor(...))
end

--- Generate a new RUCI state cursor.
-- @param session Session object
-- @param ... Parameters passed to the UCI constructor
-- @return RUCI instance
function cursor_state(session, ...)
	return setinst(session, uci.cursor_state(...))
end

--- Custom foreach function.
-- @param session Session object
-- @param inst RUCI instance
-- @param config UCI config
-- @param sectiontype UCI sectiontype
-- @return section data
function foreach(session, inst, config, sectiontype)
	local inst = getinst(session, inst)
	local secs = {}
	inst:foreach(config, sectiontype, function(s) secs[#secs+1] = s end)
	return secs
end