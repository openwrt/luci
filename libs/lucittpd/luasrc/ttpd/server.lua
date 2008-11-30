--[[
LuCIttpd
(c) 2008 Steven Barth <steven@midlink.org>
(c) 2008 Jo-Philipp Wich <xm@leipzig.freifunk.net>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--

local ipairs, pairs = ipairs, pairs
local tostring, tonumber = tostring, tonumber
local pcall, assert = pcall, assert

local os = require "os"
local io = require "io"
local util = require "luci.util"
local ltn12 = require "luci.ltn12"
local proto = require "luci.http.protocol"
local string = require "string"
local date = require "luci.http.protocol.date"

module "luci.ttpd.server"

BUFSIZE = 4096
VERSION = 0.91


-- File Resource
IOResource = util.class()

function IOResource.__init__(self, fd, offset, len)
	self.fd, self.offset, self.len = fd, offset, len
end


VHost = util.class()

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

function VHost.get_default_handler(self)
	return self.handler
end

function VHost.set_default_handler(self, handler)
	self.handler = handler
end

function VHost.get_handlers(self)
	return self.dhandler
end

function VHost.set_handler(self, match, handler)
	self.dhandler[match] = handler
end



Server = util.class()

function Server.__init__(self, host)
	self.host = host
	self.vhosts = {}
	
	self.rbuf = ""
	self.wbuf = ""
end

function Server.get_default_vhost(self)
	return self.host
end

function Server.set_default_vhost(self, vhost)
	self.host = vhost
end

function Server.get_vhosts(self)
	return self.vhosts
end

function Server.set_vhost(self, name, vhost)
	self.vhosts[name] = vhost
end

function Server.flush(self)
	if #self.wbuf > 0 then
		self._write(self.wbuf)
		self.wbuf = ""
	end
end

function Server.read(self, len)
	while #self.rbuf < len do
		self.rbuf = self.rbuf .. self._read(len - #self.rbuf)
	end
	
	local chunk = self.rbuf:sub(1, len)
	self.rbuf = self.rbuf:sub(len + 1)
	return chunk
end

function Server.limitsource(self, limit)
	limit = limit or 0

	return function()
		if limit < 1 then
			return nil
		else
			local read = (limit > BUFSIZE) and BUFSIZE or limit
			limit = limit - read
			return self:read(read)
		end
	end
end

-- Adapted from Luaposix
function Server.receiveheaders(self)
    local line, name, value, err
    local headers = {}
    -- get first line
    line, err = self:readline()
    if err then return nil, err end
    -- headers go until a blank line is found
    while line do
        -- get field-name and value
        _, _, name, value = line:find("^(.-):%s*(.*)")
        if not (name and value) then return nil, "malformed reponse headers" end
        name = name:lower()
        -- get next line (value might be folded)
        line, err = self:readline()
        if err then return nil, err end
        -- unfold any folded values
        while line:find("^%s") do
            value = value .. line
            line = self:readline()
            if err then return nil, err end
        end
        -- save pair in table
        if headers[name] then headers[name] = headers[name] .. ", " .. value
        else headers[name] = value end
    end
    return headers
end

function Server.readchunk(self)
	-- get chunk size, skip extention
	local line, err = self:readline()
	if err then return nil, err end
	local size = tonumber(line:gsub(";.*", ""), 16)
	if not size then return nil, "invalid chunk size" end
	-- was it the last chunk?
	if size > 0 then
	    -- if not, get chunk and skip terminating CRLF
	    local chunk, err, part = self:read(size)
	    if chunk then self:readline() end
	    return chunk, err
	else
	    -- if it was, read trailers into headers table
	    headers, err = self:receiveheaders()
	    if not headers then return nil, err end
	end
end

function Server.readline(self)
	if #self.rbuf < 1 then
		self.rbuf = self._read(BUFSIZE)
	end

	while true do
		local le = self.rbuf:find("\r\n", nil, true)
		if le then
			if le == 1 then -- EoH
				self.rbuf = self.rbuf:sub(le + 2)
				return nil
			else -- Header
				local line = self.rbuf:sub(1, le - 1)
				self.rbuf = self.rbuf:sub(le + 2)
				return line
			end
		else
			if #self.rbuf >= BUFSIZE then
				return nil, "Invalid Request"
			end
			self.rbuf = self.rbuf .. self._read(BUFSIZE-#self.rbuf)
		end
	end
end

function Server.sink(self)
	return function(chunk, err)
		if err then
			return nil, err
		elseif chunk then
			local stat, err = pcall(self.write, self, chunk)
			if stat then
				return stat
			else
				return nil, err
			end
		else
			return true
		end
	end
end

function Server.chunksink(self)
	return function(chunk, err)
		local stat, err = pcall(self.writechunk, self, chunk)
		if stat then
			return stat
		else
			return nil, err
		end
	end
end

function Server.writechunk(self, chunk, err)
	self:flush()
	if not chunk then return self._write("0\r\n\r\n") end
	local size = string.format("%X\r\n", #chunk)
	return self._write(size ..  chunk .. "\r\n")
end

function Server.write(self, chunk)
	while #chunk > 0 do
		local missing = BUFSIZE - #self.wbuf
		self.wbuf = self.wbuf .. chunk:sub(1, missing)
		chunk = chunk:sub(missing + 1)
		if #self.wbuf == BUFSIZE then
			assert(self._write(self.wbuf))
			self.wbuf = ""
		end
	end
end

function Server.close(self)
	self:flush()
	self._close()
end

function Server.sendfile(self, fd, offset, len)
	self:flush()
	self._sendfile(fd, offset, len)
end


function Server.error(self, code, msg)
	hcode = tostring(code)
	
	self:write( "HTTP/1.0 " .. hcode .. " " ..
	 proto.statusmsg[code] .. "\r\n" )
	self:write( "Connection: close\r\n" )
	self:write( "Content-Type: text/plain\r\n\r\n" )

	if msg then
		self:write( "HTTP-Error " .. code .. ": " .. msg .. "\r\n" )
	end
end


function Server.process(self, functions)
	util.update(self, functions)

	local sourcein  = ltn12.source.empty()
	local sourcehdr = function() return self:readline() or "" end
	local sinkerr   = ltn12.sink.file( io.stderr )
	local sinkout   = self:sink()
	
	local close = false
	local stat, message, err
	
	repeat
		-- parse headers
		stat, message, err = pcall(proto.parse_message_header, sourcehdr)

		-- remote socket closed
		if not stat and message == 0 then
			break
		end

		-- remote timeout
		if not stat and message == 11 then
			--self:error(408)
			break
		end

		-- any other error
		if not stat or not message then
			self:error(400, err)
			break
		end

		-- keep-alive
		if message.http_version == 1.1 then
			close = (message.env.HTTP_CONNECTION == "close")
		else
			close = not message.env.HTTP_CONNECTION or message.env.HTTP_CONNECTION == "close"
		end
		-- Uncomment this to disable keep-alive
		-- close = true
	
		if message.request_method == "get" or message.request_method == "head" then
			-- Be happy
			
		elseif message.request_method == "post" then
			-- If we have a HTTP/1.1 client and an Expect: 100-continue header then
			-- respond with HTTP 100 Continue message
			if message.http_version == 1.1 and message.headers['Expect'] and
				message.headers['Expect'] == '100-continue'
			then
				self:write("HTTP/1.1 100 Continue\r\n\r\n")
			end
			
			if message.headers['Transfer-Encoding'] and
			 message.headers['Transfer-Encoding'] ~= "identity" then
				sourcein = function() return self:readchunk() end
			elseif message.env.CONTENT_LENGTH then
				sourcein = self:limitsource(
					tonumber(message.env.CONTENT_LENGTH)
				)
			else
				self:error( 411, proto.statusmsg[411] )
				break
			end
		else
			self:error( 405, proto.statusmsg[405] )
			break
			
		end


		local host = self.vhosts[message.env.HTTP_HOST] or self.host
		if not host then
			self:error( 500, "Unable to find matching host" )
			break;
		end
		
		local response, sourceout = host:process(
			message, sourcein, sinkerr,
			client, io.stderr 
		)
		if not response then
			self:error( 500, "Error processing handler" )
		end
		
		-- Post process response
		if sourceout then
			if util.instanceof(sourceout, IOResource) then
				if not response.headers["Content-Length"] then
					response.headers["Content-Length"] = sourceout.len
				end
			end
			if not response.headers["Content-Length"] then
				if message.http_version == 1.1 then
					response.headers["Transfer-Encoding"] = "chunked"
					sinkout = self:chunksink()
				else
					close = true
				end
			end
		elseif message.request_method ~= "head" then
			response.headers["Content-Length"] = 0
		end
		
		if close then
			response.headers["Connection"] = "close"
		end

		response.headers["Date"] = date.to_http(os.time())

		local header =
			message.env.SERVER_PROTOCOL .. " " ..
			tostring(response.status) .. " " ..
			proto.statusmsg[response.status] .. "\r\n"

		header = header .. "Server: LuCIttpd/" .. tostring(VERSION) .. "\r\n"

		
		for k,v in pairs(response.headers) do
			header = header .. k .. ": " .. v .. "\r\n"
		end
		
		-- Output
		local stat, err = pcall(function()
			self:write(header .. "\r\n")

			if sourceout then
				if util.instanceof(sourceout, IOResource) then
					self:sendfile(sourceout.fd, sourceout.offset, sourceout.len)
				else
					ltn12.pump.all(sourceout, sinkout)
				end
			end

			self:flush()
		end)

		-- Write errors
		if not stat then
			if err == 107 then
				-- Remote end closed the socket, so do we
			elseif err then
				io.stderr:write("Error sending data: " .. err .. "\n")
			end
			break
		end
	until close
	
	self:close()
end
