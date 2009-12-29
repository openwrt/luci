--[[
LuCId HTTP-Slave
(c) 2009 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--

local ipairs, pcall, type = ipairs, pcall, type
local luci = require "luci.lucid.http.handler.luci"
local srv = require "luci.lucid.http.server"


module "luci.lucid.http.LuciWebPublisher"


--- Prepare a LuCI web publisher and assign it to a given Virtual Host.
-- @param server HTTP daemon object
-- @param config publisher configuration
function factory(server, config)
	pcall(function()
		require "luci.dispatcher"
		require "luci.cbi"
	end)

	config.domain = config.domain or ""
	local vhost = server:get_vhosts()[config.domain] 
	if not vhost then
		vhost = srv.VHost()
		server:set_vhost(config.domain, vhost)
	end

	local prefix
	if config.physical and #config.physical > 0 then
		prefix = {}
		for k in config.physical:gmatch("[^/]+") do
			if #k > 0 then
				prefix[#prefix+1] = k
			end
		end
	end

	local handler = luci.Luci(config.name, prefix)
	if config.exec then
		for _, r in ipairs(config.exec) do
			if r:sub(1,1) == ":" then
				handler:restrict({interface = r:sub(2)})
			else
				handler:restrict({user = r})
			end
		end
	end

	local mypath
	if type(config.virtual) == "table" then
		for _, v in ipairs(config.virtual) do
			mypath = mypath or v
			vhost:set_handler(v, handler)
		end
	else
		mypath = config.virtual
		vhost:set_handler(config.virtual or "", handler)
	end

	if config.home then
		vhost.default = mypath
	end
end
