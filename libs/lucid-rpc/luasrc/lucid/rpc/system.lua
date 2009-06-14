--[[
LuCI - Lua Development Framework

Copyright 2009 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]

local type, ipairs = type, ipairs
local srv = require "luci.lucid.rpc.server"
local nixio = require "nixio"
local lucid = require "luci.lucid"

--- Internal system functions.
module "luci.lucid.rpc.system"

-- Prepare the RPC module.
function _factory()
	local mod = srv.Module("System functions"):register({
		echo = echo,
		void = void,
		multicall = srv.Method.extended(multicall),
		authenticate = srv.Method.extended(authenticate)
	})
	mod.checkrestricted = function(self, session, request, ...)
		if request ~= "authenticate" then
			return srv.Module.checkrestricted(self, session, request, ...)
		end
	end
	return mod
end

--- Simple echo test function.
-- @param object to be echoed object
-- @return echo object
function echo(object)
	return object
end

--- Simple void test function.
function void()

end

--- Accumulate different requests and execute them.
-- @param session Session object
-- @param ...
-- @return overall response object
function multicall(session, ...)
	local server, responses, response = session.server, {}, nil
	for k, req in ipairs({...}) do
		response = nil
		if type(req) == "table" and type(req.method) == "string"
		 and (not req.params or type(req.params) == "table") then
		 	req.params = req.params or {}
			result = server.root:process(session, req.method, req.params)
			if type(result) == "table" then
				if req.id ~= nil then
					response = {jsonrpc=req.jsonrpc, id=req.id,
						result=result.result, error=result.error}
				end
			else
				if req.id ~= nil then
					response = {jsonrpc=req.jsonrpc, id=req.id,
					 result=nil, error={code=srv.ERRNO_INTERNAL,
					 message=srv.ERRMSG[ERRNO_INTERNAL]}}
				end
			end
		end
		responses[k] = response
	end
	return responses
end

--- Create or use a new authentication token.
-- @param session Session object
-- @param type Authentication type
-- @param entity Authentication enttity (username)
-- @param key Authentication key (password)
-- @return boolean status
function authenticate(session, type, entity, key)
	if not type then
		session.user = nil
		return true
	elseif type == "plain" then
		local pwe = nixio.getsp and nixio.getsp(entity) or nixio.getpw(entity)
		local pwh = pwe and (pwe.pwdp or pwe.passwd)
		if not pwh or #pwh < 1 or nixio.crypt(key, pwh) ~= pwh then
			return nil
		else
			session.user = entity
			return true
		end
	end
end