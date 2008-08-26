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

local require = require
local pairs = pairs
local print = print

module "luci.controller.rpc"

function index()
	local function authenticator(validator, accs)
		local auth = luci.http.formvalue("auth", true)
		if auth then
			local user = luci.sauth.read(auth)
			if user and luci.util.contains(accs, user) then
				return user, auth
			end
		end
		luci.http.status(403, "Forbidden")
	end
	
	uci = entry({"rpc", "uci"}, call("rpc_uci"))
	uci.sysauth = "root"
	uci.sysauth_authenticator = authenticator
	
	fs = entry({"rpc", "fs"}, call("rpc_fs"))
	fs.sysauth = "root"
	fs.sysauth_authenticator = authenticator

	fs = entry({"rpc", "sys"}, call("rpc_sys"))
	fs.sysauth = "root"
	fs.sysauth_authenticator = authenticator
	
	uci = entry({"rpc", "auth"}, call("rpc_auth"))
end

function rpc_auth()
	local jsonrpc = require "luci.jsonrpc"
	local sauth   = require "luci.sauth"
	local http    = require "luci.http"
	local sys     = require "luci.sys"
	
	http.setfilehandler()
	
	local loginstat
	
	local server = {}
	server.login = function(user, pass)
		local sid
		
		if sys.user.checkpasswd(user, pass) then
			sid = sys.uniqueid(16)
			http.header("Set-Cookie", "sysauth=" .. sid.."; path=/")
			sauth.write(sid, user)
		end
		
		return sid
	end
	
	http.prepare_content("application/json")
	http.write(jsonrpc.handle(server, http.content()))
end

function rpc_uci()
	local uci     = require "luci.controller.rpc.uci"
	local jsonrpc = require "luci.jsonrpc"
	local http    = require "luci.http"
	
	http.setfilehandler()
	http.prepare_content("application/json")
	http.write(jsonrpc.handle(uci, http.content()))
end

function rpc_fs()
	local fs      = require "luci.fs"
	local jsonrpc = require "luci.jsonrpc"
	local http    = require "luci.http"
	
	http.setfilehandler()
	http.prepare_content("application/json")
	http.write(jsonrpc.handle(fs, http.content()))
end

function rpc_sys()
	local sys     = require "luci.sys"
	local jsonrpc = require "luci.jsonrpc"
	local http    = require "luci.http"
	
	http.setfilehandler()
	http.prepare_content("application/json")
	http.write(jsonrpc.handle(sys, http.content()))
end