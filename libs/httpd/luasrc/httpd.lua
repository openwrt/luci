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
require("luci.http.protocol")
require("luci.httpd.server")


local srv  = luci.httpd.server
local host = "0.0.0.0"
local port = 50000


server = socket.bind(host, port)
server:settimeout( 0, "t" )

reading = { server }
running = { }


while true do

	local input = socket.select( reading, nil, 0.1 )

	-- accept new connections
	for i, connection in ipairs(input) do

		local sock = connection:accept()

		-- check capacity
		if #running < srv.MAX_CLIENTS then

			table.insert( running, {
				coroutine.create( srv.client_handler ),
				sock
			} )

		-- reject client
		else
			srv.error503( sock )
		end
	end

	-- create client handler
	for i, client in ipairs( running ) do

		-- reap dead clients
		if coroutine.status( client[1] ) == "dead" then
			table.remove( running, i )
		end

		coroutine.resume( client[1], client[2] )
	end
end
