--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>
Copyright 2008 Jo-Philipp Wich <xm@leipzig.freifunk.net>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--
module("luci.controller.rpc", package.seeall)

function index()
	local authenticator = function(validator)
		require "luci.jsonrpc"
		require "luci.http"
		luci.http.setfilehandler()
		
		local loginstat
		
		local server = {}
		server.login = function(...)
			loginstat = validator(...)
			return loginstat
		end
		
		luci.http.prepare_content("application/json")
		luci.http.write(luci.jsonrpc.handle(server, luci.http.content()))
		
		return loginstat
	end
	
	uci = entry({"rpc", "uci"}, call("rpc_uci"))
	uci.sysauth = "root"
	uci.sysauth_authenticator = authenticator
end

function rpc_uci()
	luci.http.write("HELLO THAR!")
end