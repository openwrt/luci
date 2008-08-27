--[[

HTTP server implementation for LuCI - core
(c) 2008 Freifunk Leipzig / Jo-Philipp Wich <xm@leipzig.freifunk.net>
(c) 2008 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

$Id$

]]--

module("luci.httpd", package.seeall)
require("socket")

THREAD_IDLEWAIT = 0.01
THREAD_TIMEOUT  = 90
THREAD_LIMIT    = nil

local reading   = {}
local clhandler = {}
local erhandler = {}

local threadc = 0
local threads = {}
local threadm = {}
local threadi = {}

local _meta = {__mode = "k"}
setmetatable(threadm, _meta)
setmetatable(threadi, _meta)


function Socket(ip, port)
	local sock, err = socket.bind( ip, port )

	if sock then
		sock:settimeout( 0, "t" )
	end

	return sock, err
end

function corecv(socket, ...)
	threadi[socket] = true

	while true do
		local chunk, err, part = socket:receive(...)

		if err ~= "timeout" then
			threadi[socket] = false
			return chunk, err, part
		end
 
		coroutine.yield()
	end
end

function cosend(socket, chunk, i, ...)
	threadi[socket] = true
	i = i or 1

	while true do
		local stat, err, sent = socket:send(chunk, i, ...)

		if err ~= "timeout" then
			threadi[socket] = false
			return stat, err, sent
		else
			i = sent and (sent + 1) or i
		end
 
		coroutine.yield()
	end
end

function register(socket, s_clhandler, s_errhandler)
	table.insert(reading, socket)
	clhandler[socket] = s_clhandler
	erhandler[socket] = s_errhandler
end

function run()
	while true do
		step()
	end
end

function step()
	local idle = true
	if not THREAD_LIMIT or threadc < THREAD_LIMIT then
		local now = os.time()
		for i, server in ipairs(reading) do
			local client = server:accept()
			if client then
				threadm[client] = now
				threadc = threadc + 1
				threads[client] = coroutine.create(clhandler[server])
			end
		end
	end
	
	for client, thread in pairs(threads) do
		coroutine.resume(thread, client)
		local now = os.time()
		if coroutine.status(thread) == "dead" then
			threadc = threadc - 1
			threads[client] = nil
		elseif threadm[client] and threadm[client] + THREAD_TIMEOUT < now then
			threads[client] = nil
			threadc = threadc - 1	
			client:close()
		elseif not threadi[client] then 
			threadm[client] = now
			idle = false
		end
	end
	
	if idle then
		socket.sleep(THREAD_IDLEWAIT)
	end
end
