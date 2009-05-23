--[[
LuCId HTTP-Slave
(c) 2009 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--

local srv = require "luci.lucid.http.server"
local proto = require "luci.http.protocol"

module "luci.lucid.http.handler.catchall"

Redirect = util.class(srv.Handler)

function Redirect.__init__(self, name, target)
	srv.Handler.__init__(self, name)
	self.target = target
end

function Redirect.handle_GET(self, request)
	local target = self.target
	local protocol = request.env.HTTPS and "https://" or "http://"
	local server = request.env.SERVER_ADDR
	if server:find(":") then
		server = "[" .. server .. "]"
	end

	if self.target:sub(1,1) == ":" then
		target = protocol .. server .. target
	end

	local s, e = target:find("%TARGET%", 1, true)
	if s then
		local req = protocol .. (request.env.HTTP_HOST or server)
			.. request.env.REQUEST_URI 
		target = target:sub(1, s-1) .. req .. target:sub(e+1)
	end

	return 302, { Location = target }
end

Redirect.handle_POST = Redirect.handle_GET

function Redirect.handle_HEAD(self, request)
	local stat, head = self:handle_GET(request)
	return stat, head
end