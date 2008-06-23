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

function VHost.process(self, request, sourcein, sinkout, sinkerr)
	local handler = self.handler

	local uri = request.env.REQUEST_URI:match("^([^?]*)")

	-- SCRIPT_NAME
	request.env.SCRIPT_NAME = ""

	-- Call URI part
	request.env.PATH_INFO = uri

	for k, dhandler in pairs(self.dhandler) do
		if k == uri or k.."/" == uri:sub(1, #k+1) then
			handler = dhandler
			request.env.SCRIPT_NAME = k
			request.env.PATH_INFO   = uri:sub(#k+1)
			break;
		end
	end

	if handler then
		handler:process(request, sourcein, sinkout, sinkerr)
		return true
	else
		return false
	end
end


function VHost.set_default_handler(self, handler)
	self.handler = handler
end


function VHost.set_handler(self, match, handler)
	self.dhandler[match] = handler
end



Server = luci.util.class()

function Server.__init__(self, host)
	self.clhandler = client_handler
	self.errhandler = error503
	self.host = host
	self.vhosts = {}
end

function Server.set_default_vhost(self, vhost)
	self.host = vhost
end

-- Sets a vhost
function Server.set_vhost(self, name, vhost)
	self.vhosts[name] = vhost
end

function Server.create_daemon_handlers(self)
	return function(...) return self:process(...) end,
		function(...) return self:error503(...) end
end

function Server.create_client_sources(self, client)
	-- Create LTN12 block source
	local block_source = function()

		-- Yielding here may cause chaos in coroutine based modules, be careful
		-- coroutine.yield()

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
		elseif chunk ~= nil

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

	return block_source, line_source
end


function Server.error400(self, socket, msg)
	socket:send( "HTTP/1.0 400 Bad request\r\n" )
	socket:send( "Content-Type: text/plain\r\n\r\n" )

	if msg then
		socket:send( msg .. "\r\n" )
	end

	socket:close()
end

function Server.error500(self, socket, msg)
	socket:send( "HTTP/1.0 500 Internal Server Error\r\n" )
	socket:send( "Content-Type: text/plain\r\n\r\n" )

	if msg then
		socket:send( msg .. "\r\n" )
	end

	socket:close()
end

function Server.error503(self, socket)
	socket:send( "HTTP/1.0 503 Server unavailable\r\n" )
	socket:send( "Content-Type: text/plain\r\n\r\n" )
	socket:send( "There are too many clients connected, try again later\r\n" )
	socket:close()
end


function Server.process(self, client)

	client:settimeout( 0 )
	local sourcein, sourcehdr = self:create_client_sources(client)
	local sinkerr = ltn12.sink.file(io.stderr)

	-- FIXME: Add keep-alive support
	local sinkout = socket.sink("close-when-done", client)

	coroutine.yield()

	-- parse headers
	local message, err = luci.http.protocol.parse_message_header( sourcehdr )

	if message then
		-- If we have a HTTP/1.1 client and an Expect: 100-continue header then
		-- respond with HTTP 100 Continue message
		if message.http_version == 1.1 and message.headers['Expect'] and
			message.headers['Expect'] == '100-continue'
		then
			client:send("HTTP/1.1 100 Continue\r\n\r\n")
		end

		local host = self.vhosts[message.env.HTTP_HOST] or self.host
		if host then
			if host:process(message, sourcein, sinkout, sinkerr) then
				sinkout()
			else
				self:error500( client, "No suitable path handler found" )
			end
		else
			self:error500( client, "No suitable host handler found" )
		end
	else
		self:error400( client, err )
		return nil
	end
end
