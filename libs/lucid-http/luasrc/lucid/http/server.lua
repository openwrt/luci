--[[
LuCId HTTP-Slave
(c) 2009 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--

local ipairs, pairs = ipairs, pairs
local tostring, tonumber = tostring, tonumber
local pcall, assert, type = pcall, assert, type

local os = require "os"
local nixio = require "nixio"
local util = require "luci.util"
local ltn12 = require "luci.ltn12"
local proto = require "luci.http.protocol"
local table = require "table"
local date = require "luci.http.protocol.date"

module "luci.lucid.http.server"

VERSION = "1.0"

statusmsg = {
	[200] = "OK",
	[206] = "Partial Content",
	[301] = "Moved Permanently",
	[302] = "Found",
	[304] = "Not Modified",
	[400] = "Bad Request",
	[401] = "Unauthorized",
	[403] = "Forbidden",
	[404] = "Not Found",
	[405] = "Method Not Allowed",
	[408] = "Request Time-out",
	[411] = "Length Required",
	[412] = "Precondition Failed",
	[416] = "Requested range not satisfiable",
	[500] = "Internal Server Error",
	[503] = "Server Unavailable",
}

-- File Resource
IOResource = util.class()

function IOResource.__init__(self, fd, len)
	self.fd, self.len = fd, len
end


-- Server handler implementation
Handler = util.class()

function Handler.__init__(self, name)
	self.name = name or tostring(self)
end

-- Creates a failure reply
function Handler.failure(self, code, msg)	
	return code, { ["Content-Type"] = "text/plain" }, ltn12.source.string(msg)
end

-- Access Restrictions
function Handler.restrict(self, restriction)
	if not self.restrictions then
		self.restrictions = {restriction}
	else
		self.restrictions[#self.restrictions+1] = restriction
	end
end

-- Check restrictions
function Handler.checkrestricted(self, request)
	if not self.restrictions then
		return
	end

	local localif, user, pass
	
	for _, r in ipairs(self.restrictions) do
		local stat = true
		if stat and r.interface then	-- Interface restriction
			if not localif then
				for _, v in ipairs(request.server.interfaces) do
					if v.addr == request.env.SERVER_ADDR then
						localif = v.name
						break
					end
				end
			end
			
			if r.interface ~= localif then
				stat = false
			end
		end
		
		if stat and r.user then	-- User restriction
			local rh, pwe
			if not user then
				rh = (request.headers.Authorization or ""):match("Basic (.*)")
				rh = rh and nixio.bin.b64decode(rh) or ""
				user, pass = rh:match("(.*):(.*)")
				pass = pass or ""
			end
			pwe = nixio.getsp and nixio.getsp(r.user) or nixio.getpw(r.user)
			local pwh = (user == r.user) and pwe and (pwe.pwdp or pwe.passwd)
			if not pwh or #pwh < 1 or nixio.crypt(pass, pwh) ~= pwh then
				stat = false
			end
		end
		
		if stat then
			return
		end
	end
	
	return 401, {
		["WWW-Authenticate"] = ('Basic realm=%q'):format(self.name),
		["Content-Type"] = 'text/plain'
	}, ltn12.source.string("Unauthorized")
end

-- Processes a request
function Handler.process(self, request, sourcein)
	local stat, code, hdr, sourceout
	
	local stat, code, msg = self:checkrestricted(request)
	if stat then	-- Access Denied
		return stat, code, msg
	end

	-- Detect request Method
	local hname = "handle_" .. request.env.REQUEST_METHOD
	if self[hname] then
		-- Run the handler
		stat, code, hdr, sourceout = pcall(self[hname], self, request, sourcein)

		-- Check for any errors
		if not stat then
			return self:failure(500, code)
		end
	else
		return self:failure(405, statusmsg[405])
	end

	return code, hdr, sourceout
end


VHost = util.class()

function VHost.__init__(self)
	self.handlers = {}
end

function VHost.process(self, request, ...)
	local handler
	local hlen = -1
	local uri = request.env.SCRIPT_NAME
	local sc = ("/"):byte()

	-- SCRIPT_NAME
	request.env.SCRIPT_NAME = ""

	-- Call URI part
	request.env.PATH_INFO = uri
	
	for k, h in pairs(self.handlers) do
		if #k > hlen then
			if uri == k or (uri:sub(1, #k) == k and uri:byte(#k+1) == sc) then
				handler = h
				hlen = #k
				request.env.SCRIPT_NAME = k
				request.env.PATH_INFO   = uri:sub(#k+1)
			end
		end
	end
	
	if handler then
		return handler:process(request, ...)
	else
		return 404, nil, ltn12.source.string("No such handler")
	end
end

function VHost.get_handlers(self)
	return self.handlers
end

function VHost.set_handler(self, match, handler)
	self.handlers[match] = handler
end


local function remapipv6(adr)
	local map = "::ffff:"
	if adr:sub(1, #map) == map then
		return adr:sub(#map+1)
	else
		return adr
	end 
end

local function chunksource(sock, buffer)
	buffer = buffer or ""
	return function()
		local output
		local _, endp, count = buffer:find("^([0-9a-fA-F]+);?.-\r\n")
		while not count and #buffer <= 1024 do
			local newblock, code = sock:recv(1024 - #buffer)
			if not newblock then
				return nil, code
			end
			buffer = buffer .. newblock  
			_, endp, count = buffer:find("^([0-9a-fA-F]+);?.-\r\n")
		end
		count = tonumber(count, 16)
		if not count then
			return nil, -1, "invalid encoding"
		elseif count == 0 then
			return nil
		elseif count + 2 <= #buffer - endp then
			output = buffer:sub(endp+1, endp+count)
			buffer = buffer:sub(endp+count+3)
			return output
		else
			output = buffer:sub(endp+1, endp+count)
			buffer = ""
			if count - #output > 0 then
				local remain, code = sock:recvall(count-#output)
				if not remain then
					return nil, code
				end
				output = output .. remain
				count, code = sock:recvall(2)
			else
				count, code = sock:recvall(count+2-#buffer+endp)
			end
			if not count then
				return nil, code
			end
			return output
		end
	end
end

local function chunksink(sock)
	return function(chunk, err)
		if not chunk then
			return sock:writeall("0\r\n\r\n")
		else
			return sock:writeall(("%X\r\n%s\r\n"):format(#chunk, chunk))
		end
	end
end

Server = util.class()

function Server.__init__(self)
	self.vhosts = {}
end

function Server.get_vhosts(self)
	return self.vhosts
end

function Server.set_vhost(self, name, vhost)
	self.vhosts[name] = vhost
end

function Server.error(self, client, code, msg)
	hcode = tostring(code)
	
	client:writeall( "HTTP/1.0 " .. hcode .. " " ..
	 statusmsg[code] .. "\r\n" )
	client:writeall( "Connection: close\r\n" )
	client:writeall( "Content-Type: text/plain\r\n\r\n" )

	if msg then
		client:writeall( "HTTP-Error " .. code .. ": " .. msg .. "\r\n" )
	end
	
	client:close()
end

local hdr2env = {
	["Content-Length"] = "CONTENT_LENGTH",
	["Content-Type"] = "CONTENT_TYPE",
	["Content-type"] = "CONTENT_TYPE",
	["Accept"] = "HTTP_ACCEPT",
	["Accept-Charset"] = "HTTP_ACCEPT_CHARSET",
	["Accept-Encoding"] = "HTTP_ACCEPT_ENCODING",
	["Accept-Language"] = "HTTP_ACCEPT_LANGUAGE",
	["Connection"] = "HTTP_CONNECTION",
	["Cookie"] = "HTTP_COOKIE",
	["Host"] = "HTTP_HOST",
	["Referer"] = "HTTP_REFERER",
	["User-Agent"] = "HTTP_USER_AGENT"
}

function Server.parse_headers(self, source)
	local env = {}
	local req = {env = env, headers = {}}
	local line, err

	repeat	-- Ignore empty lines
		line, err = source()
		if not line then
			return nil, err
		end
	until #line > 0
	
	env.REQUEST_METHOD, env.REQUEST_URI, env.SERVER_PROTOCOL =
		line:match("^([A-Z]+) ([^ ]+) (HTTP/1%.[01])$")
		
	if not env.REQUEST_METHOD then
		return nil, "invalid magic"
	end
	
	local key, envkey, val
	repeat
		line, err = source()
		if not line then
			return nil, err
		elseif #line > 0 then	
			key, val = line:match("^([%w-]+)%s?:%s?(.*)")
			if key then
				req.headers[key] = val
				envkey = hdr2env[key]
				if envkey then
					env[envkey] = val
				end
			else
				return nil, "invalid header line"
			end
		else
			break
		end
	until false

	if env.REQUEST_URI:find("?") then	
		env.SCRIPT_NAME, env.QUERY_STRING = env.REQUEST_URI:match("([^%?]*)%?(.*)")
	else
		env.SCRIPT_NAME, env.QUERY_STRING = env.REQUEST_URI, nil
	end

	return req
end


function Server.process(self, client, env)
	local sourcein  = function() end
	local sourcehdr = client:linesource()
	local sinkout
	local buffer
	
	local close = false
	local stat, code, msg, message, err
	
	client:setsockopt("socket", "rcvtimeo", 5)
	client:setsockopt("socket", "sndtimeo", 5)
	
	repeat
		-- parse headers
		message, err = self:parse_headers(sourcehdr)

		-- any other error
		if not message or err then
			if err == 11 then	-- EAGAIN
				break
			else
				return self:error(client, 400, err)
			end
		end

		-- Prepare sources and sinks
		buffer = sourcehdr(true)
		sinkout = client:sink()
		message.server = env
		
		if client:is_tls_socket() then
			message.env.HTTPS = "on"
		end
		
		-- Addresses
		message.env.REMOTE_ADDR = remapipv6(env.host)
		message.env.REMOTE_PORT = env.port
		
		local srvaddr, srvport = client:getsockname()
		message.env.SERVER_ADDR = remapipv6(srvaddr)
		message.env.SERVER_PORT = srvport
		
		-- keep-alive
		if message.env.SERVER_PROTOCOL == "HTTP/1.1" then
			close = (message.env.HTTP_CONNECTION == "close")
		else
			close = not message.env.HTTP_CONNECTION 
				or message.env.HTTP_CONNECTION == "close"
		end

		-- Uncomment this to disable keep-alive
		close = close or env.config.nokeepalive
	
		if message.env.REQUEST_METHOD == "GET"
		or message.env.REQUEST_METHOD == "HEAD" then
			-- Be happy
			
		elseif message.env.REQUEST_METHOD == "POST" then
			-- If we have a HTTP/1.1 client and an Expect: 100-continue header
			-- respond with HTTP 100 Continue message
			if message.env.SERVER_PROTOCOL == "HTTP/1.1" 
			and message.headers.Expect == '100-continue' then
				client:writeall("HTTP/1.1 100 Continue\r\n\r\n")
			end
			
			if message.headers['Transfer-Encoding'] and
			 message.headers['Transfer-Encoding'] ~= "identity" then
				sourcein = chunksource(client, buffer)
				buffer = nil
			elseif message.env.CONTENT_LENGTH then
				local len = tonumber(message.env.CONTENT_LENGTH)
				if #buffer >= len then
					sourcein = ltn12.source.string(buffer:sub(1, len))
					buffer = buffer:sub(len+1)
				else
					sourcein = ltn12.source.cat(
						ltn12.source.string(buffer),
						client:blocksource(nil, len - #buffer)
					)
				end
			else
				return self:error(client, 411, statusmsg[411])
			end
		else
			return self:error(client, 405, statusmsg[405])
		end


		local host = self.vhosts[message.env.HTTP_HOST] or self.vhosts[""]
		if not host then
			return self:error(client, 404, "No virtual host found")
		end
		
		local code, headers, sourceout = host:process(message, sourcein)
		headers = headers or {}
		
		-- Post process response
		if sourceout then
			if util.instanceof(sourceout, IOResource) then
				if not headers["Content-Length"] then
					headers["Content-Length"] = sourceout.len
				end
			end
			if not headers["Content-Length"] then
				if message.env.SERVER_PROTOCOL == "HTTP/1.1" then
					headers["Transfer-Encoding"] = "chunked"
					sinkout = chunksink(client)
				else
					close = true
				end
			end
		elseif message.env.REQUEST_METHOD ~= "HEAD" then
			headers["Content-Length"] = 0
		end
		
		if close then
			headers["Connection"] = "close"
		elseif message.env.SERVER_PROTOCOL == "HTTP/1.0" then
			headers["Connection"] = "Keep-Alive"
		end 

		headers["Date"] = date.to_http(os.time())
		local header = {
			message.env.SERVER_PROTOCOL .. " " .. tostring(code) .. " " 
				.. statusmsg[code],
			"Server: LuCId-HTTPd/" .. VERSION
		}

		
		for k, v in pairs(headers) do
			if type(v) == "table" then
				for _, h in ipairs(v) do
					header[#header+1] = k .. ": " .. h
				end
			else
				header[#header+1] = k .. ": " .. v
			end
		end

		header[#header+1] = ""
		header[#header+1] = ""
		
		-- Output
		stat, code, msg = client:writeall(table.concat(header, "\r\n"))

		if sourceout and stat then
			if util.instanceof(sourceout, IOResource) then
				stat, code, msg = sourceout.fd:copyz(client, sourceout.len)
			else
				stat, msg = ltn12.pump.all(sourceout, sinkout)
			end
		end


		-- Write errors
		if not stat then
			if msg then
				nixio.syslog("err", "Error sending data to " .. env.host ..
					": " .. msg .. "\n")
			end
			break
		end
		
		if buffer then
			sourcehdr(buffer)
		end
	until close
	
	client:shutdown()
	client:close()
end
