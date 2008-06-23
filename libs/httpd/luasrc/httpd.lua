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


Daemon = luci.util.class()

function Daemon.__init__(self, threadlimit, timeout)
	self.reading = {}
	self.running = {}
	self.handler = {}
	self.debug   = false
	self.threadlimit = threadlimit
	self.timeout = timeout or 0.1
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

	if err == "timeout" and #self.running == 0 then
		socket.sleep(self.timeout)
	end

	-- accept new connections
	for i, connection in ipairs(input) do

		local sock = connection:accept()
		
		if sock then
			-- check capacity
			if not self.threadlimit or #self.running < self.threadlimit then
				
				if self.debug then
					self:dprint("Accepted incoming connection from " .. sock:getpeername())
				end
	
				table.insert( self.running, {
					coroutine.create( self.handler[connection].clhandler ),
					sock
				} )
	
				if self.debug then
					self:dprint("Created " .. tostring(self.running[#self.running][1]))
				end
	
			-- reject client
			else
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
	for i, client in ipairs( self.running ) do

		-- reap dead clients
		if coroutine.status( client[1] ) == "dead" then
			if self.debug then
				self:dprint("Completed " .. tostring(client[1]))
			end
			table.remove( self.running, i )
		else
			if self.debug then
				self:dprint("Resuming " .. tostring(client[1]))
			end

			local stat, err = coroutine.resume( client[1], client[2] )
			
			if self.debug then
				self:dprint(tostring(client[1]) .. " returned")
				if not stat then
					self:dprint("Error in " .. tostring(client[1]) .. " " .. err)
				end
			end
		end
	end
end
