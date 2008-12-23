--[[

HTTP server implementation for LuCI - helper class
(c) 2008 Freifunk Leipzig / Jo-Philipp Wich <xm@leipzig.freifunk.net>
(c) 2008 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

$Id$

]]--

module("luci.httpd.server", package.seeall)
require("socket")
require("socket.http")
require("luci.util")

READ_BUFSIZE = 1024
VERSION = 0.2


VHost = luci.util.class()

function VHost.__init__(self, handler)
	self.handler = handler
	self.dhandler = {}
end

function VHost.process(self, request, sourcein, sinkerr, ...)
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
		return handler:process(request, sourcein, sinkerr, ...)
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
		function(...) return self:error_overload(...) end
end


function Server.error(self, socket, code, msg)
	hcode = tostring(code)
	
	socket:send( "HTTP/1.0 " .. hcode .. " " ..
	 luci.http.protocol.statusmsg[code] .. "\r\n" )
	socket:send( "Connection: close\r\n" )
	socket:send( "Content-Type: text/plain\r\n\r\n" )

	if msg then
		socket:send( "HTTP-Error " .. code .. ": " .. msg .. "\r\n" )
	end
end

function Server.error_overload(self, socket)
	self:error(socket, 503, "Too many simultaneous connections")
end


function Server.process( self, client )

	-- Setup sockets and sources
	local thread = {
		receive = function(self, ...) return luci.httpd.corecv(client, ...) end,
		send = function(self, ...) return luci.httpd.cosend(client, ...) end,
		close = function(self, ...) return client:close(...) end,
		getfd = function(self, ...) return client:getfd(...) end,
		dirty = function(self, ...) return client:dirty(...) end
	}
	
	client:settimeout( 0 )
	
	local sourcein  = ltn12.source.empty()
	local sourcehdr = luci.http.protocol.header_source( thread )
	local sinkerr   = ltn12.sink.file( io.stderr )
	
	local close = false
	
	local reading = { client }

	local message, err
	
	repeat
		-- parse headers
		message, err = luci.http.protocol.parse_message_header( sourcehdr )

		if not message then
			self:error( thread, 400, err )
			break
		end	
		
		-- keep-alive
		if message.http_version == 1.1 then
			close = (message.env.HTTP_CONNECTION == "close")
		else
			close = not message.env.HTTP_CONNECTION or message.env.HTTP_CONNECTION == "close"
		end
	
		if message.request_method == "get" or message.request_method == "head" then
			-- Be happy
			
		elseif message.request_method == "post" then
			-- If we have a HTTP/1.1 client and an Expect: 100-continue header then
			-- respond with HTTP 100 Continue message
			if message.http_version == 1.1 and message.headers['Expect'] and
				message.headers['Expect'] == '100-continue'
			then
				thread:send("HTTP/1.1 100 Continue\r\n\r\n")
			end
			
			if message.headers['Transfer-Encoding'] and
			 message.headers['Transfer-Encoding'] ~= "identity" then
				sourcein = socket.source("http-chunked", thread)
			elseif message.env.CONTENT_LENGTH then
				sourcein = socket.source("by-length", thread,
				 tonumber(message.env.CONTENT_LENGTH))
			else
				self:error( thread, 411, luci.http.protocol.statusmsg[411] )
				break;
			end

			-- FIXME: Close for POST requests
			close = true
		else
			self:error( thread, 405, luci.http.protocol.statusmsg[405] )
			break;
			
		end


		local host = self.vhosts[message.env.HTTP_HOST] or self.host
		if not host then
			self:error( thread, 500, "Unable to find matching host" )
			break;
		end
		
		local response, sourceout = host:process(
			message, sourcein, sinkerr,
			client, io.stderr 
		)
		if not response then
			self:error( thread, 500, "Error processing handler" )
		end
		
		-- Post process response
		local sinkmode = close and "close-when-done" or "keep-open"
		
		if sourceout then
			if not response.headers["Content-Length"] then
				if message.http_version == 1.1 then
					response.headers["Transfer-Encoding"] = "chunked"
					sinkmode = "http-chunked"
				else
					close = true
					sinkmode = "close-when-done"
				end
			end
		end
		
		if close then
			response.headers["Connection"] = "close"
		end
		
		
		local sinkout = socket.sink(sinkmode, thread)
		
		local header =
			message.env.SERVER_PROTOCOL .. " " ..
			tostring(response.status) .. " " ..
			luci.http.protocol.statusmsg[response.status] .. "\r\n"

		header = header .. "Server: LuCI HTTPd/" .. tostring(VERSION) .. "\r\n"

		
		for k,v in pairs(response.headers) do
			header = header .. k .. ": " .. v .. "\r\n"
		end
		
		thread:send(header .. "\r\n")

		if sourceout then
			local eof = false
			repeat
				coroutine.yield()
				eof = not ltn12.pump.step(sourceout, sinkout)
			until eof
		end
	until close
	
	client:close()
end
