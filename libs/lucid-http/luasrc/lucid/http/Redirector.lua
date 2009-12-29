--[[
LuCId HTTP-Slave
(c) 2009 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--

local ipairs = ipairs
local catchall = require "luci.lucid.http.handler.catchall"
local srv = require "luci.lucid.http.server"

module "luci.lucid.http.Redirector"

--- Prepare a redirector publisher and assign it to a given Virtual Host.
-- @param server HTTP daemon object
-- @param config publisher configuration
function factory(server, config)
	config.domain = config.domain or ""
	local vhost = server:get_vhosts()[config.domain] 
	if not vhost then
		vhost = srv.VHost()
		server:set_vhost(config.domain, vhost)
	end

	local handler = catchall.Redirect(config.name, config.physical)
	vhost:set_handler(config.virtual or "", handler)
end
