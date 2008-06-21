--[[

HTTP server implementation for LuCI - helper class
(c) 2008 Freifunk Leipzig / Jo-Philipp Wich <xm@leipzig.freifunk.net>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

$Id$

]]--

module("luci.httpd.server", package.seeall)
require("luci.util")

READ_BUFSIZE = 1024

VHost = luci.util.class()

function VHost.__init__(self, handler)
	self.handler = handler
	self.dhandler = {}
end

function VHost.process(self, ...)
	-- TODO: Dispatch handler
end

function VHost.sethandler(self, handler, match)
	if match then
		self.dhandler[match] = handler
	else
		self.handler = handler
	end
end



Server = luci.util.class()

function Server.__init__(self, ip, port, base)
	self.socket = socket.bind(ip, port)
	self.socket:settimeout(0, "t")
	self.clhandler = client_handler
	self.errhandler = error503
	self.host = nil
	self.vhosts = {}
	
	-- Clone another server
	if base then
		getmetatable(self).__index = base 
	end
end

-- Sets a vhost
function Server.setvhost(self, vhost, name)
	if name then
		self.vhosts[name] = vhost
	else
		self.host = vhost
	end
end


function Server.error400(self, client, msg)
	client:send( "HTTP/1.0 400 Bad request\r\n" )
	client:send( "Content-Type: text/plain\r\n\r\n" )

	if msg then
		client:send( msg .. "\r\n" )
	end

	client:close()
end

function Server.error503(self, client)
	client:send( "HTTP/1.0 503 Server unavailable\r\n" )
	client:send( "Content-Type: text/plain\r\n\r\n" )
	client:send( "There are too many clients connected, try again later\r\n" )
end

function Server.process(self, ...)
	-- TODO: Dispatch vhost
end


function Server.client_handler(self, client)

	client:settimeout( 0 )

	-- Create LTN12 block source
	local block_source = function()

		coroutine.yield()

		local chunk, err, part = client:receive( READ_BUFSIZE )

		if chunk == nil and err == "timeout" then
			return part
		elseif chunk ~= nil then
			return chunk
		else
			return nil, err
		end

	end

	-- Create LTN12 line source
	local line_source = ltn12.source.simplify( function()

		coroutine.yield()

		local chunk, err, part = client:receive("*l")

		-- Line too long
		if chunk == nil and err ~= "timeout" then

			return nil, part
				and "Line exceeds maximum allowed length["..part.."]"
				or  "Unexpected EOF"

		-- Line ok
		else

			-- Strip trailing CR
			chunk = chunk:gsub("\r$","")

			-- We got end of headers, switch to dummy source
			if #chunk == 0 then
				return "", function()
					return nil
				end
			else
				return chunk, nil
			end
		end
	end )

	coroutine.yield(client)


	-- parse message
	local message, err = luci.http.protocol.parse_message_header( line_source )

	if message then

		-- If we have a HTTP/1.1 client and an Expect: 100-continue header then
		-- respond with HTTP 100 Continue message
		if message.http_version == 1.1 and message.headers['Expect'] and
			message.headers['Expect'] == '100-continue'
		then
			client:send("HTTP/1.1 100 Continue\r\n\r\n")
		end


		local s, e = luci.http.protocol.parse_message_body( block_source, message )

		-- XXX: debug
		luci.util.dumptable( message )

		if not s and e then
			self:error400( client, e )
		end
	else
		self:error400( client, err )
	end

	-- send response
	self:error400( client, "Dummy response" )
end
