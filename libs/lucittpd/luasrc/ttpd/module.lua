--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--

local pcall, ipairs, tonumber, type, next = pcall, ipairs, tonumber, type, next
local util = require "luci.util"
local http = require "luci.http.protocol"
local ltn12 = require "luci.ltn12"
local table = require "table"

module "luci.ttpd.module"


-- Server handler implementation
Handler = util.class()

-- Constructor
function Handler.__init__(self)
	self.handler   = {}
	self.filters   = {}
	self.modifiers = {}
end

-- Add a filter
function Handler.setfilter(self, filter, key)
	self.filters[(key) or (#self.filters+1)] = filter
end

-- Add a modifier
function Handler.setmodifier(self, modifier, key)
	self.modifiers[(pos) or (#self.modifiers+1)] = modifier
end

-- Creates a failure reply
function Handler.failure(self, code, message)
	local response = Response(code, { ["Content-Type"] = "text/plain" })
	local sourceout = ltn12.source.string(message)
	
	return response, sourceout 
end

-- Processes a request
function Handler.process(self, request, sourcein, sinkerr)
	local stat, response, sourceout

	-- Detect request Method
	local hname = "handle_" .. request.request_method
	if self[hname] then
		local t = {
			processor = self[hname],
			handler = self,
			request = request,
			sourcein = sourcein,
			sinkerr = sinkerr
		}

		if next(self.modifiers) then
			for _, mod in util.kspairs(self.modifiers) do
				mod(t)
			end
		end

		-- Run the handler
		stat, response, sourceout = pcall(
			t.processor, t.handler, t.request, t.sourcein, t.sinkerr
		)

		-- Check for any errors
		if not stat then
			response, sourceout = self:failure(500, response)
		elseif next(self.filters) then
			local t = {
				response = response,
				sourceout = sourceout,
				sinkerr = t.sinkerr
			}

			for _, filter in util.kspairs(self.filters) do
				filter(t)
			end

			response = t.response
			sourceout = t.sourceout
		end
	else
		response, sourceout = self:failure(405, http.protocol.statusmsg[405])
	end

	-- Check data
	if not util.instanceof(response, Response) then
		response, sourceout = self:failure(500, "Core error: Invalid module response!")
	end

	return response, sourceout
end

-- Handler Response 
Response = util.class()

function Response.__init__(self, status, headers)
	self.status = tonumber(status) or 200
	self.headers = (type(headers) == "table") and headers or {}
end

function Response.addheader(self, key, value)
	self.headers[key] = value
end

function Response.setstatus(self, status)
	self.status = status
end