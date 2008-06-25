--[[

HTTP server implementation for LuCI - core
(c) 2008 Freifunk Leipzig / Jo-Philipp Wich <xm@leipzig.freifunk.net>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

$Id$

]]--

module("luci.httpd", package.seeall)
require("socket")
require("luci.util")

function Socket(ip, port)
	local sock, err = socket.bind( ip, port )

	if sock then
		sock:settimeout( 0, "t" )
	end

	return sock, err
end

Thread = luci.util.class()

function Thread.__init__(self, socket, func)
	self.socket  = socket
	self.routine = coroutine.create(func)
	self.stamp   = os.time()
	self.waiting = false
end

function Thread.touched(self)
	return self.stamp
end

function Thread.iswaiting(self)
	return self.waiting
end

function Thread.receive(self, ...)
	local chunk, err, part
	self.waiting = true
	
	repeat
		coroutine.yield()
		chunk, err, part = self.socket:receive(...)
	until err ~= "timeout"
	
	self.waiting = false
	return chunk, err, part
end

function Thread.resume(self, ...)
	return coroutine.resume(self.routine, self, ...)
end

function Thread.isdead(self)
	return coroutine.status(self.routine) == "dead"
end

function Thread.touch(self)
	self.stamp = os.time()
end

Daemon = luci.util.class()

function Daemon.__init__(self, threadlimit, waittime, timeout)
	self.reading = {}
	self.threads = {}
	self.handler = {}
	self.waiting = {}
	self.threadc = 0
	
	setmetatable(self.waiting, {__mode = "v"})
	
	self.debug   = false
	self.threadlimit = threadlimit
	self.waittime = waittime or 0.1
	self.timeout  = timeout or 90
end

function Daemon.remove_dead(self, thread)
	if self.debug then
		self:dprint("Completed " .. tostring(thread))
	end
	thread.socket:close()
	self.threadc = self.threadc - 1
	self.threads[thread.socket] = nil
end

function Daemon.kill_timedout(self)
	local now = os.time()
	
	for k, v in pairs(self.threads) do
		if os.difftime(now, thread:touched()) > self.timeout then
			self.threads[sock] = nil
			self.threadc = self.threadc - 1
			sock:close()
		end
	end
end

function Daemon.dprint(self, msg)
	if self.debug then
		io.stderr:write("[daemon] " .. msg .. "\n")
	end
end

function Daemon.register(self, sock, clhandler, errhandler)
	table.insert( self.reading, sock )
	self.handler[sock] = { clhandler = clhandler, errhandler = errhandler }
end

function Daemon.run(self)
	while true do
		self:step()
	end
end

function Daemon.step(self)	
	local input, output, err = socket.select( self.reading, nil, 0 )
	local working = false

	-- accept new connections
	for i, connection in ipairs(input) do

		local sock = connection:accept()
		
		if sock then
			-- check capacity
			if not self.threadlimit or self.threadc < self.threadlimit then
				
				if self.debug then
					self:dprint("Accepted incoming connection from " .. sock:getpeername())
				end
				
				local t = Thread(sock, self.handler[connection].clhandler)
				self.threads[sock] = t
				self.threadc = self.threadc + 1
	
				if self.debug then
					self:dprint("Created " .. tostring(t))
				end
	
			-- reject client
			else
				self:kill_timedout()
			
				if self.debug then
					self:dprint("Rejected incoming connection from " .. sock:getpeername())
				end
	
				if self.handler[connection].errhandler then
					self.handler[connection].errhandler( sock )
				end
	
				sock:close()
			end
		end
	end

	-- create client handler
	for sock, thread in pairs( self.threads ) do		
		-- resume working threads
		if not thread:iswaiting() then
			if self.debug then
				self:dprint("Resuming " .. tostring(thread))
			end

			local stat, err = thread:resume()
			if stat and not thread:isdead() then
				thread:touch()
				if not thread:iswaiting() then
					working = true
				else
					table.insert(self.waiting, sock)
				end
			else
				self:remove_dead(thread)
			end
			
			if self.debug then
				self:dprint(tostring(thread) .. " returned")
				if not stat then
					self:dprint("Error in " .. tostring(thread) .. " " .. err)
				end
			end
		end
	end
	
	-- check for data on waiting threads
	input, output, err = socket.select( self.waiting, nil, 0 )
	
	for i, sock in ipairs(input) do	
		local thread = self.threads[sock]
		thread:resume()
		if thread:isdead() then
			self:remove_dead(thread)
		else
			thread:touch()
			
			if not thread:iswaiting() then
				for i, s in ipairs(self.waiting) do
					if s == sock then
						table.remove(self.waiting, i)
						break
					end
				end
				if not working then
					working = true
				end
			end
		end
	end
	
	if err == "timeout" and not working then
		self:kill_timedout()
		socket.sleep(self.waittime)
	end
end
