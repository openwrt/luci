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
local fs = require "nixio.fs"
local nixio = require "nixio"
local lucid = require "luci.lucid"

local ipairs, type, require, setmetatable = ipairs, type, require, setmetatable
local pairs, print, tostring, unpack = pairs, print, tostring, unpack
local pcall = pcall

module "luci.lucid.tcpserver"

local cursor = lucid.cursor
local UCINAME = lucid.UCINAME

local tcpsockets = {}

--- Prepare a daemon and allocate its resources. (superserver callback)
-- @param config configuration table
-- @param server LuCId basemodule
-- @return binary data
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

--- Accept a new TCP connection. (server callback)
-- @param polle Poll descriptor
-- @return handler process id or nil, error code, error message 
function accept(polle)
	if not lucid.try_process() then
		return false
	end
	local socket, host, port = polle.fd:accept()
	if not socket then
		return nixio.syslog("warning", "accept() failed: " .. port)
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

--- Prepare a TCP server socket.
-- @param family protocol family ["inetany", "inet6", "inet"]
-- @param host host
-- @param port port
-- @param opts table of socket options
-- @param backlog socket backlog
-- @return socket, final socket family
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

--- Prepare a TLS server context and load keys and certificates.
-- May invoke px5g to create keys and certificate on demand if available.
-- @param tlskey TLS configuration identifier
-- @return TLS server conext or nil
function prepare_tls(tlskey)
	local tls
	if nixio.tls and tlskey and cursor:get(UCINAME, tlskey) then
		tls = nixio.tls("server")
		
		local make = cursor:get(UCINAME, tlskey, "generate") == "1"
		local key = cursor:get(UCINAME, tlskey, "key")
		local xtype = make and "asn1" or cursor:get(UCINAME, tlskey, "type")
		local cert = cursor:get(UCINAME, tlskey, "cert")
		local ciphers = cursor:get(UCINAME, tlskey, "ciphers")
		
		if make and (not fs.access(key) or not fs.access(cert)) then
			local CN = cursor:get(UCINAME, tlskey, "CN")
			local O = cursor:get(UCINAME, tlskey, "O")
			local bits = 2048
			
			local data = {
				CN = CN or nixio.uname().nodename,
				O = not O and "LuCId Keymaster" or #O > 0 and O
			}
			
			local stat, px5g = pcall(require, "px5g")
			if not stat then
				return nixio.syslog("err", "Unable to load PX5G Keymaster")
			end
			
			nixio.syslog("warning", "PX5G: Generating private key")
			local rk = px5g.genkey(bits)
			local keyfile = nixio.open(key, "w", 600)
			if not rk or not keyfile or not keyfile:writeall(rk:asn1()) then
				return nixio.syslog("err", "Unable to generate private key")
			end
			keyfile:close()
			
			nixio.syslog("warning", "PX5G: Generating self-signed certificate")
			if not fs.writefile(cert, rk:create_selfsigned(data,
					os.time(), os.time() + 3600 * 24 * 366 * 15)) then
				return nixio.syslog("err", "Unable to generate certificate")
			end
		end
		
		if cert then
			if not tls:set_cert(cert, xtype) then
				nixio.syslog("err", "Unable to load certificate: " .. cert)
			end
		end
		if key then
			if not tls:set_key(key, xtype) then
				nixio.syslog("err", "Unable to load private key: " .. key)
			end
		end

		if ciphers then
			if type(ciphers) == "table" then
				ciphers = table.concat(ciphers, ":")
			end
			tls:set_ciphers(ciphers)
		end
	end
	return tls
end
