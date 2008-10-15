--[[

HTTP server implementation for LuCI - luci handler
(c) 2008 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

$Id$

]]--

module("luci.httpd.handler.luci", package.seeall)

require("luci.dispatcher")
require("luci.http")
require("luci.http.protocol.date")
local ltn12 = require("luci.ltn12")

Luci = luci.util.class(luci.httpd.module.Handler)
Response = luci.httpd.module.Response

function Luci.__init__(self, limit)
	luci.httpd.module.Handler.__init__(self)
	self.limit = limit or 5
	self.running = {}
	setmetatable(self.running, {__mode = "k"})
end

function Luci.handle_head(self, ...)
	local response, sourceout = self:handle_get(...)
	return response
end

function Luci.handle_post(self, ...)
	return self:handle_get(...)
end

function Luci.handle_get(self, request, sourcein, sinkerr)
	local reaped  = false
	local running = 0

	for _, v in pairs(self.running) do
		if v then running = running + 1 end
	end

	if self.limit and running >= self.limit then
		for k, v in ipairs(self.running) do
			if coroutine.status(k) == "dead" then
				self.running[k] = nil
				running = running - 1
				reaped  = true
			end
		end

		if reaped then collectgarbage() end

		if running >= self.limit then
			return self:failure(503, "Overload %i/%i" % { running, self.limit } )
		end
	end

	self.running[coroutine.running()] = true

	local r = luci.http.Request(
		request.env,
		sourcein,
		sinkerr
	)

	local res, id, data1, data2 = true, 0, nil, nil
	local headers = {}
	local status = 200
	local active = true

	local x = coroutine.create(luci.dispatcher.httpdispatch)
	while not id or id < 3 do
		coroutine.yield()

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
