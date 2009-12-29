--[[
LuCId HTTP-Slave
(c) 2009 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--

local ipairs, require, tostring, type = ipairs, require, tostring, type
local file = require "luci.lucid.http.handler.file"
local srv = require "luci.lucid.http.server"

module "luci.lucid.http.DirectoryPublisher"


--- Prepare a directory publisher and assign it to a given Virtual Host.
-- @param server HTTP daemon object
-- @param config publisher configuration
function factory(server, config)
	config.domain = config.domain or ""
	local vhost = server:get_vhosts()[config.domain] 
	if not vhost then
		vhost = srv.VHost()
		server:set_vhost(config.domain, vhost)
	end

	local handler = file.Simple(config.name, config.physical, config)
	if config.read then
		for _, r in ipairs(config.read) do
			if r:sub(1,1) == ":" then
				handler:restrict({interface = r:sub(2)})
			else
				handler:restrict({user = r})
			end
		end
	end
	
	if type(config.virtual) == "table" then
		for _, v in ipairs(config.virtual) do
			vhost:set_handler(v, handler)
		end
	else
		vhost:set_handler(config.virtual or "", handler)
	end
end
