--[[
nixio - Linux I/O library for lua

Copyright 2009 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--

local table = require "table"
local nixio = require "nixio"
local getmetatable, assert, pairs = getmetatable, assert, pairs

module "nixio.util"

local BUFFERSIZE = 8096
local socket = nixio.meta_socket
local tls_socket = nixio.meta_tls_socket
local file = nixio.meta_file

local meta = {}

function meta.is_socket(self)
	return (getmetatable(self) == socket)
end

function meta.is_tls_socket(self)
	return (getmetatable(self) == tls_socket)
end

function meta.is_file(self)
	return (getmetatable(self) == file)
end

function meta.readall(self, len)
	local block, code, msg = self:read(len)

	if not block then
		return "", code, msg, len
	elseif #block == 0 then
		return "", nil, nil, len
	end

	local data, total = {block}, #block

	while len > total do
		block, code, msg = self:read(len - total)

		if not block then
			return data, code, msg, len - #data
		elseif #block == 0 then
			return data, nil, nil, len - #data
		end

		data[#data+1], total = block, total + #block
	end

	return (#data > 1 and table.concat(data) or data[1]), nil, nil, 0
end
meta.recvall = meta.readall

function meta.writeall(self, data)
	local total, block = 0
	local sent, code, msg = self:write(data)

	if not sent then
		return total, code, msg, data
	end

	while sent < #data do
		block, total = data:sub(sent + 1), total + sent
		sent, code, msg = self:write(block)
		
		if not sent then
			return total, code, msg, block
		end
	end
	
	return total + sent, nil, nil, ""
end
meta.sendall = meta.writeall

function meta.linesource(self, limit)
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
				local newblock, code = self:read(limit + bpos - #buffer)
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

function meta.blocksource(self, bs, limit)
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

		local block, code, msg = self:read(toread)

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

function meta.sink(self, close)
	return function(chunk, src_err)
		if not chunk and not src_err and close then
			if self.shutdown then
				self:shutdown()
			end
			self:close()
		elseif chunk and #chunk > 0 then
			return self:writeall(chunk)
		end
		return true
	end
end

function tls_socket.close(self)
	return self.socket:close()
end

for k, v in pairs(meta) do
	file[k] = v
	socket[k] = v
	tls_socket[k] = v
end