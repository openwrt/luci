--[[

HTTP server implementation for LuCI - core
(c) 2008 Freifunk Leipzig / Jo-Philipp Wich <xm@leipzig.freifunk.net>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

$Id$

]]--

require("ltn12")
require("socket")
require("luci.util")


Daemon = luci.util.class()

function Daemon.__init__(self, threadlimit)
	self.reading = {}
	self.running = {}
	self.handler = {}
	self.threadlimit = threadlimit
end

function Daemon.register(self, socket, clhandler, errhandler)
	table.insert( self.reading, socket )
	self.handler[socket] = { clhandler = clhandler, errhandler = errhandler }
end

function Daemon.run(self)
	while true do
		self:step()
	end
end

function Daemon.step(self)	
	local input = socket.select( self.reading, nil, 0 )

	-- accept new connections
	for i, connection in ipairs(input) do

		local sock = connection:accept()

		-- check capacity
		if self.threadlimit and #running < self.threadlimit then

			table.insert( self.running, {
				coroutine.create( self.handler[connection].clhandler ),
				sock
			} )

		-- reject client
		else
			if self.handler[connection].errhandler then
				self.handler[connection].errhandler( sock )
			end
			
			sock:close()
		end
	end

	-- create client handler
	for i, client in ipairs( self.running ) do

		-- reap dead clients
		if coroutine.status( client[1] ) == "dead" then
			table.remove( self.running, i )
		end

		coroutine.resume( client[1], client[2] )
	end
end
