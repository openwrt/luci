--[[
LuCI - Lua Development Framework

Copyright 2009 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]

local os = require "os"
local nixio = require "nixio"
local lucid = require "luci.lucid"

local ipairs, type, require, setmetatable = ipairs, type, require, setmetatable
local pairs, print, tostring, unpack = pairs, print, tostring, unpack

module "luci.lucid.tcpserver"

local cursor = lucid.cursor
local UCINAME = lucid.UCINAME

local tcpsockets = {}


function prepare_daemon(config, server)
	nixio.syslog("info", "Preparing TCP-Daemon " .. config[".name"])
	if type(config.address) ~= "table" then
		config.address = {config.address}
	end
	
	local sockets, socket, code, err = {}
	local sopts = {reuseaddr = 1}
	for _, addr in ipairs(config.address) do
		local host, port = addr:match("(.-):?([^:]*)")
		if not host then
			nixio.syslog("err", "Invalid address: " .. addr)
			return nil, -5, "invalid address format"
		elseif #host == 0 then
			host = nil
		end
		socket, code, err = prepare_socket(config.family, host, port, sopts)
		if socket then
			sockets[#sockets+1] = socket
		end
	end
	
	nixio.syslog("info", "Sockets bound for " .. config[".name"])
	
	if #sockets < 1 then
		return nil, -6, "no sockets bound"
	end
	
	nixio.syslog("info", "Preparing publishers for " .. config[".name"])
	
	local publisher = {}
	for k, pname in ipairs(config.publisher) do
		local pdata = cursor:get_all(UCINAME, pname)
		if pdata then
			publisher[#publisher+1] = pdata
		else
			nixio.syslog("err", "Publisher " .. pname .. " not found")
		end
	end
	
	nixio.syslog("info", "Preparing TLS for " .. config[".name"])
	
	local tls = prepare_tls(config.tls)
	if not tls and config.encryption == "enable" then
		for _, s in ipairs(sockets) do
			s:close()
		end
		return nil, -4, "Encryption requested, but no TLS context given"
	end
	
	nixio.syslog("info", "Invoking daemon factory for " .. config[".name"])
	local handler, err = config.slave.module.factory(publisher, config)
	if not handler then
		for _, s in ipairs(sockets) do
			s:close()
		end
		return nil, -3, err
	else
		local pollin = nixio.poll_flags("in")
		for _, s in ipairs(sockets) do
			server.register_pollfd({
				fd = s,
				events = pollin,
				revents = 0,
				handler = accept,
				accept = handler,
				config = config,
				publisher = publisher,
				tls = tls
			})
		end
		return true
	end
end

function accept(polle)
	local socket, host, port = polle.fd:accept()
	if not socket then
		return nixio.syslog("warn", "accept() failed: " .. port)
	end
	
	socket:setblocking(true)
	
	local function thread()
		lucid.close_pollfds()
		local inst = setmetatable({
			host = host, port = port, interfaces = lucid.get_interfaces() 
		}, {__index = polle})
		if polle.config.encryption then
			socket = polle.tls:create(socket)
			if not socket:accept() then
				socket:close()
				return nixio.syslog("warning", "TLS handshake failed: " .. host)
			end
		end
		
		return polle.accept(socket, inst)
	end
	
	local stat = {lucid.create_process(thread)}
	socket:close()
	return unpack(stat)
end

function prepare_socket(family, host, port, opts, backlog)
	nixio.syslog("info", "Preparing socket for port " .. port)
	backlog = backlog or 1024
	family = family or "inetany"
	opts = opts or {}
	
	local inetany = family == "inetany"
	family = inetany and "inet6" or family

	local socket, code, err = nixio.socket(family, "stream")
	if not socket and inetany then
		family = "inet"
		socket, code, err = nixio.socket(family, "stream")
	end
	
	if not socket then
		return nil, code, err
	end

	for k, v in pairs(opts) do
		socket:setsockopt("socket", k, v)
	end
	
	local stat, code, err = socket:bind(host, port)
	if not stat then
		return nil, code, err
	end
	
	stat, code, err = socket:listen(backlog)
	if not stat then
		return nil, code, err
	end
	
	socket:setblocking(false)

	return socket, family
end

function prepare_tls(tlskey)
	local tls = nixio.tls("server")
	if tlskey and cursor:get(UCINAME, tlskey) then
		local cert = cursor:get(UCINAME, tlskey, "cert")
		if cert then
			tls:set_cert(cert)
		end
		local key = cursor:get(UCINAME, tlskey, "key")
		if key then
			tls:set_key(key)
		end
		local ciphers = cursor:get(UCINAME, tlskey, "ciphers")
		if ciphers then
			if type(ciphers) == "table" then
				ciphers = table.concat(ciphers, ":")
			end
			tls:set_ciphers(ciphers)
		end
	end
	return tls
end