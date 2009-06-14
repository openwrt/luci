--[[
LuCI - Lua Development Framework

Copyright 2009 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]

local ipairs, pairs = ipairs, pairs
local tostring, tonumber = tostring, tonumber
local pcall, assert, type, unpack = pcall, assert, type, unpack

local nixio = require "nixio"
local json = require "luci.json"
local util = require "luci.util"
local table = require "table"
local ltn12 = require "luci.ltn12"

--- RPC daemom.
-- @cstyle instance
module "luci.lucid.rpc.server"

RQLIMIT = 32 * nixio.const.buffersize
VERSION = "1.0"

ERRNO_PARSE = -32700
ERRNO_INVALID = -32600
ERRNO_UNKNOWN = -32001
ERRNO_TIMEOUT = -32000
ERRNO_NOTFOUND = -32601
ERRNO_NOACCESS = -32002
ERRNO_INTERNAL = -32603
ERRNO_NOSUPPORT = -32003

ERRMSG = {
	[ERRNO_PARSE] = "Parse error.",
	[ERRNO_INVALID] = "Invalid request.",
	[ERRNO_TIMEOUT] = "Connection timeout.",
	[ERRNO_UNKNOWN] = "Unknown error.",
	[ERRNO_NOTFOUND] = "Method not found.",
	[ERRNO_NOACCESS] = "Access denied.",
	[ERRNO_INTERNAL] = "Internal error.",
	[ERRNO_NOSUPPORT] = "Operation not supported."
}


--- Create an RPC method wrapper.
-- @class function
-- @param method Lua function
-- @param description Method description
-- @return Wrapped RPC method 
Method = util.class()

--- Create an extended wrapped RPC method.
-- @class function
-- @param method Lua function
-- @param description Method description
-- @return Wrapped RPC method 
function Method.extended(...)
	local m = Method(...)
	m.call = m.xcall
	return m
end

function Method.__init__(self, method, description)
	self.description = description
	self.method = method
end

--- Extended call the associated function.
-- @param session Session storage
-- @param argv Request parameters
-- @return function call response
function Method.xcall(self, session, argv)
	return self.method(session, unpack(argv))
end

--- Standard call the associated function.
-- @param session Session storage
-- @param argv Request parameters
-- @return function call response
function Method.call(self, session, argv)
	return self.method(unpack(argv))
end

--- Process a given request and create a JSON response.
-- @param session Session storage
-- @param request Requested method
-- @param argv Request parameters
function Method.process(self, session, request, argv)
	local stat, result = pcall(self.call, self, session, argv)
	
	if stat then
		return { result=result }
	else
		return { error={ 
			code=ERRNO_UNKNOWN, 
			message=ERRMSG[ERRNO_UNKNOWN],
			data=result
		} }
	end
end

-- Remap IPv6-IPv4-compatibility addresses to IPv4 addresses
local function remapipv6(adr)
	local map = "::ffff:"
	if adr:sub(1, #map) == map then
		return adr:sub(#map+1)
	else
		return adr
	end 
end


--- Create an RPC module.
-- @class function
-- @param description Method description
-- @return RPC module 
Module = util.class()

function Module.__init__(self, description)
	self.description = description
	self.handler = {}
end

--- Add a handler.
-- @param k key
-- @param v handler
function Module.add(self, k, v)
	self.handler[k] = v
end

--- Add an access restriction.
-- @param restriction Restriction specification
function Module.restrict(self, restriction)
	if not self.restrictions then
		self.restrictions = {restriction}
	else
		self.restrictions[#self.restrictions+1] = restriction
	end
end

--- Enforce access restrictions.
-- @param request Request object
-- @return nil or HTTP statuscode, table of headers, response source
function Module.checkrestricted(self, session, request, argv)
	if not self.restrictions then
		return
	end
	
	for _, r in ipairs(self.restrictions) do
		local stat = true
		if stat and r.interface then	-- Interface restriction
			if not session.localif then
				for _, v in ipairs(session.env.interfaces) do
					if v.addr == session.localaddr then
						session.localif = v.name
						break
					end
				end
			end
			
			if r.interface ~= session.localif then
				stat = false
			end
		end
		
		if stat and r.user and session.user ~= r.user then	-- User restriction
			stat = false
		end
		
		if stat then
			return
		end
	end
	
	return {error={code=ERRNO_NOACCESS, message=ERRMSG[ERRNO_NOACCESS]}}
end

--- Register a handler, submodule or function.
-- @param m entity
-- @param descr description
-- @return Module (self)
function Module.register(self, m, descr)
	descr = descr or {}
	for k, v in pairs(m) do
		if util.instanceof(v, Method) then
			self.handler[k] = v
		elseif type(v) == "table" then
			self.handler[k] = Module()
			self.handler[k]:register(v, descr[k])
		elseif type(v) == "function" then
			self.handler[k] = Method(v, descr[k])
		end
	end
	return self
end

--- Process a request.
-- @param session Session storage
-- @param request Request object
-- @param argv Request parameters
-- @return JSON response object
function Module.process(self, session, request, argv)
	local first, last = request:match("^([^.]+).?(.*)$")

	local stat = self:checkrestricted(session, request, argv)
	if stat then	-- Access Denied
		return stat
	end
	
	local hndl = first and self.handler[first]
	if not hndl then
		return {error={code=ERRNO_NOTFOUND, message=ERRMSG[ERRNO_NOTFOUND]}}
	end
	
	session.chain[#session.chain+1] = self
	return hndl:process(session, last, argv)
end


--- Create a server object.
-- @class function
-- @param root Root module
-- @return Server object
Server = util.class()

function Server.__init__(self, root)
	self.root = root
end

--- Get the associated root module.
-- @return Root module
function Server.get_root(self)
	return self.root
end

--- Set a new root module.
-- @param root Root module
function Server.set_root(self, root)
	self.root = root
end

--- Create a JSON reply.
-- @param jsonrpc JSON-RPC version
-- @param id Message id
-- @param res Result
-- @param err Error
-- @reutrn JSON response source
function Server.reply(self, jsonrpc, id, res, err)
	id = id or json.null
	
	-- 1.0 compatibility
	if jsonrpc ~= "2.0" then
		jsonrpc = nil
		res = res or json.null
		err = err or json.null
	end
	
	return json.Encoder(
			{id=id, result=res, error=err, jsonrpc=jsonrpc}, BUFSIZE
		):source()
end

--- Handle a new client connection.
-- @param client client socket
-- @param env superserver environment
function Server.process(self, client, env)
	local decoder
	local sinkout = client:sink()
	client:setopt("socket", "sndtimeo", 90)
	client:setopt("socket", "rcvtimeo", 90)
	
	local close = false
	local session = {server = self, chain = {}, client = client, env = env,
		localaddr = remapipv6(client:getsockname())}
	local req, stat, response, result, cb
	
	repeat
		local oldchunk = decoder and decoder.chunk 
		decoder = json.ActiveDecoder(client:blocksource(nil, RQLIMIT))
		decoder.chunk = oldchunk
		
		result, response, cb = nil, nil, nil

		-- Read one request
		stat, req = pcall(decoder.get, decoder)
		
		if stat then
			if type(req) == "table" and type(req.method) == "string"
			 and (not req.params or type(req.params) == "table") then
			 	req.params = req.params or {}
				result, cb = self.root:process(session, req.method, req.params)
				if type(result) == "table" then
					if req.id ~= nil then
						response = self:reply(req.jsonrpc, req.id,
							result.result, result.error)
					end
					close = result.close
				else
					if req.id ~= nil then
						response = self:reply(req.jsonrpc, req.id, nil,
						  {code=ERRNO_INTERNAL, message=ERRMSG[ERRNO_INTERNAL]})
					end
				end
			else
				response = self:reply(req.jsonrpc, req.id,
				 nil, {code=ERRNO_INVALID, message=ERRMSG[ERRNO_INVALID]})
			end
		else
			if nixio.errno() ~= nixio.const.EAGAIN then
				response = self:reply("2.0", nil,
					nil, {code=ERRNO_PARSE, message=ERRMSG[ERRNO_PARSE]})
			--[[else
				response = self:reply("2.0", nil,
					nil, {code=ERRNO_TIMEOUT, message=ERRMSG_TIMEOUT})]]
			end
			close = true
		end
		
		if response then
			ltn12.pump.all(response, sinkout)
		end
		
		if cb then
			close = cb(client, session, self) or close
		end
	until close
	
	client:shutdown()
	client:close()
end
