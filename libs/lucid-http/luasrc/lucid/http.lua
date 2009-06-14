--[[
LuCI - Lua Configuration Interface

Copyright 2009 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--

local require, ipairs, pcall = require, ipairs, pcall
local srv = require "luci.lucid.http.server"

module "luci.lucid.http"

--- Prepare the HTTP-daemon and its associated publishers.
-- @param publisher Table of publishers
-- @return factory callback or nil, error message
function factory(publisher)
	local server = srv.Server()
	for _, r in ipairs(publisher) do
		local t = r[".type"]
		local s, mod = pcall(require, "luci.lucid.http." .. (r[".type"] or ""))
		if s and mod then
			mod.factory(server, r)
		else
			return nil, mod
		end
	end

	return function(...) return server:process(...) end
end