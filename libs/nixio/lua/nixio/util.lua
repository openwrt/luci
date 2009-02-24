--[[
nixio - Linux I/O library for lua

Copyright 2008 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--

local table = require "table"
local nixio = require "nixio"
local getmetatable, assert = getmetatable, assert

module "nixio.util"

local BUFFERSIZE = 8096
local socket = nixio.socket_meta
local tls_socket = nixio.tls_socket_meta

function socket.is_socket(self)
	return (getmetatable(self) == socket)
end
tls_socket.is_socket = socket.is_socket

function socket.is_tls_socket(self)
	return (getmetatable(self) == tls_socket)
end
tls_socket.is_tls_socket = socket.is_tls_socket

function socket.recvall(self, len)
	local block, code, msg = self:recv(len)

	if not block then
		return "", code, msg, len
	elseif #block == 0 then
		return "", nil, nil, len
	end

	local data, total = {block}, #block

	while len > total do
		block, code, msg = self:recv(len - total)

		if not block then
			return data, code, msg, len - #data
		elseif #block == 0 then
			return data, nil, nil, len - #data
		end

		data[#data+1], total = block, total + #block
	end

	return (#data > 1 and table.concat(data) or data[1]), nil, nil, 0
end
tls_socket.recvall = socket.recvall

function socket.sendall(self, data)
	local total, block = 0
	local sent, code, msg = self:send(data)

	if not sent then
		return total, code, msg, data
	end

	while sent < #data do
		block, total = data:sub(sent + 1), total + sent
		sent, code, msg = self:send(block)
		
		if not sent then
			return total, code, msg, block
		end
	end
	
	return total + sent, nil, nil, ""
end
tls_socket.sendall = socket.sendall

function socket.linesource(self, limit)
	limit = limit or BUFFERSIZE
	local buffer = ""
	local bpos = 0
	return function(flush)
		local line, endp, _
		
		if flush then
			line = buffer:sub(bpos + 1)
			buffer = ""
			bpos = 0
			return line
		end

		while not line do
			_, endp, line = buffer:find("(.-)\r?\n", bpos + 1)
			if line then
				bpos = endp
				return line
			elseif #buffer < limit + bpos then
				local newblock, code = self:recv(limit + bpos - #buffer)
				if not newblock then
					return nil, code
				elseif #newblock == 0 then
					return nil
				end
				buffer = buffer:sub(bpos + 1) .. newblock
				bpos = 0
			else
				return nil, 0
			end
		end
	end
end
tls_socket.linesource = socket.linesource

function socket.blocksource(self, bs, limit)
	bs = bs or BUFFERSIZE
	return function()
		local toread = bs
		if limit then
			if limit < 1 then
				return nil
			elseif limit < toread then
				toread = limit
			end
		end

		local block, code, msg = self:recv(toread)

		if not block then
			return nil, code
		elseif #block == 0 then
			return nil
		else
			if limit then
				limit = limit - #block
			end

			return block
		end
	end
end
tls_socket.blocksource = socket.blocksource

function tls_socket.close(self)
	self:shutdown()
	return self.socket:close()
end