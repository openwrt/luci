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
	local function authenticator(validator, accs)
		local args = luci.dispatcher.context.args
		if args and #args > 0 then
			local user = luci.sauth.read(args[1])
			if user and luci.util.contains(accs, user) then
				return user
			end
		end
		luci.http.status(403, "Forbidden")
	end
	
	uci = entry({"rpc", "uci"}, call("rpc_uci"))
	uci.sysauth = "root"
	uci.sysauth_authenticator = authenticator
	uci.leaf = true
	
	uci = entry({"rpc", "auth"}, call("rpc_auth"))
end

function rpc_auth()
	require "luci.jsonrpc"
	require "luci.sauth"
	
	luci.http.setfilehandler()
	
	local loginstat
	
	local server = {}
	server.login = function(user, pass)
		local sid
		
		if luci.sys.user.checkpasswd(user, pass) then
			sid = luci.sys.uniqueid(16)
			luci.http.header("Set-Cookie", "sysauth=" .. sid.."; path=/")
			luci.sauth.write(sid, user)
		end
		
		return sid
	end
	
	luci.http.prepare_content("application/json")
	luci.http.write(luci.jsonrpc.handle(server, luci.http.content()))
	
	return loginstat
end

function rpc_uci()
	
end