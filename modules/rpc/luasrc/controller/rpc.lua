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
	local ltn12   = require "luci.ltn12"
	
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
	ltn12.pump.all(jsonrpc.handle(server, http.source()), http.write)
end

function rpc_uci()
	local uci     = require "luci.controller.rpc.uci"
	local jsonrpc = require "luci.jsonrpc"
	local http    = require "luci.http"
	local ltn12   = require "luci.ltn12"
	
	http.prepare_content("application/json")
	ltn12.pump.all(jsonrpc.handle(uci, http.source()), http.write)
end

function rpc_fs()
	local util    = require "luci.util"
	local fs      = util.clone(require "luci.fs")
	local jsonrpc = require "luci.jsonrpc"
	local http    = require "luci.http"
	local ltn12   = require "luci.ltn12"
	
	function fs.readfile(filename)
		if not pcall(require, "mime") then
			error("Base64 support not available. Please install LuaSocket.")
		end
		
		return ltn12.source.chain(ltn12.source.file(filename), mime.encode("base64"))
	end
	
	function fs.writefile(filename, data)
		if not pcall(require, "mime") then
			error("Base64 support not available. Please install LuaSocket.")
		end
	
		local sink = ltn12.sink.chain(mime.decode("base64"), ltn12.sink.file(filename))
		return ltn12.pump.all(ltn12.source.string(data), sink)
	end
	
	http.prepare_content("application/json")
	ltn12.pump.all(jsonrpc.handle(fs, http.source()), http.write)
end

function rpc_sys()
	local sys     = require "luci.sys"
	local jsonrpc = require "luci.jsonrpc"
	local http    = require "luci.http"
	local ltn12   = require "luci.ltn12"
	
	http.prepare_content("application/json")
	ltn12.pump.all(jsonrpc.handle(sys, http.source()), http.write)
end