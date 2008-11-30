--[[

HTTP server implementation for LuCI - luci handler
(c) 2008 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

$Id$

]]--
local dsp = require "luci.dispatcher"
local util = require "luci.util"
local http = require "luci.http"
local ltn12 = require "luci.ltn12"
local mod = require "luci.ttpd.module"
local table = require "table"
local coroutine = require "coroutine"

module "luci.ttpd.handler.luci"

Luci = util.class(mod.Handler)
Response = mod.Response

function Luci.__init__(self, limit)
	mod.Handler.__init__(self)
end

function Luci.handle_head(self, ...)
	return (self:handle_get(...))
end

function Luci.handle_post(self, ...)
	return self:handle_get(...)
end

function Luci.handle_get(self, request, sourcein, sinkerr)
	local r = http.Request(
		request.env,
		sourcein,
		sinkerr
	)

	local res, id, data1, data2 = true, 0, nil, nil
	local headers = {}
	local status = 200
	local active = true

	local x = coroutine.create(dsp.httpdispatch)
	while not id or id < 3 do
		res, id, data1, data2 = coroutine.resume(x, r)

		if not res then
			status = 500
			headers["Content-Type"] = "text/plain"
			local err = {id}
			return Response( status, headers ), function() return table.remove(err) end
		end

		if id == 1 then
			status = data1
		elseif id == 2 then
			headers[data1] = data2
		end
	end

	local function iter()
		local res, id, data = coroutine.resume(x)
		if not res then
			return nil, id
		elseif not id or not active then
			return true
		elseif id == 5 then
			active = false

			while (coroutine.resume(x)) do
			end

			return nil
		elseif id == 4 then
			return data
		end
		if coroutine.status(x) == "dead" then
			return nil
		end
	end

	return Response(status, headers), iter
end
