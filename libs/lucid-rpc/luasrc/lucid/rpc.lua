--[[
LuCI - Lua Development Framework

Copyright 2009 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]

local require, ipairs, pcall = require, ipairs, pcall
local srv = require "luci.lucid.rpc.server"

module "luci.lucid.rpc"

--- Prepare the RPC-daemon and its associated publishers.
-- @param publisher Table of publishers
-- @return factory callback or nil, error message
function factory(publisher)
	local root = srv.Module()
	local server = srv.Server(root)

	for _, r in ipairs(publisher) do
		for _, m in ipairs(r.export) do
			local s, mod = pcall(require, r.namespace .. "." .. m)
			if s and mod then
				local module = mod._factory()
				
				if r.exec then
					for _, x in ipairs(r.exec) do
						if x:sub(1,1) == ":" then
							module:restrict({interface = x:sub(2)})
						else
							module:restrict({user = x})
						end
					end
				end
				
				root:add(m, module)
			else
				return nil, mod
			end
		end
	end

	return function(...) return server:process(...) end
end