--[[
LuCIRPCc
(c) 2009 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--

local util = require "luci.util"
local rawget, setmetatable = rawget, setmetatable
local ipairs = ipairs

--- Transparent UCI over RPC client.
-- @cstyle instance
module "luci.rpcc.ruci"


local Proxy = util.class()

--- Create a new UCI over RPC proxy.
-- @param rpccl RPC client
-- @return Network transparent UCI module 
function factory(rpccl)
	return {
		cursor = function(...)
			return Proxy(rpccl, rpccl:request("ruci.cursor", {...}))
		end,
		cursor_state = function(...)
			return Proxy(rpccl, rpccl:request("ruci.cursor_state", {...}))
		end
	}
end

function Proxy.__init__(self, rpccl, objid)
	self.__rpccl = rpccl
	self.__objid = objid

	setmetatable(self, {
		__index = function(self, key)
			return rawget(self, key) or Proxy[key] or function(self, ...)
				local argv = {self.__objid, ...}
				return self.__rpccl:request("ruci."..key, argv)
			end
		end
	})
end

function Proxy.foreach(self, config, section, callback)
	local sections = self.__rpccl:request("ruci.foreach", {self.__objid, config, section})
	if sections then
		for _, s in ipairs(sections) do
			callback(s)
		end
		return true
	else
		return false
	end
end
