--[[
nixio - Linux I/O library for lua

Copyright 2008 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--

local nixio = require "nixio"
local setmetatable, assert = setmetatable, assert

module "nixio.util"

local BUFFERSIZE = 8096
local socket = nixio.socket_meta

function socket.sendall(self, data)
	local sent, code, msg = self:send(data)

	if not sent then
		return sent, code, msg, data
	end

	while sent < #data do 
		data = data:sub(sent + 1)
		sent, code, msg = self:send(data)
		
		if not sent then
			return sent, code, msg, data
		end
	end
	
	return true
end

function socket.linesource(self, limit)
	limit = limit or BUFFERSIZE
	local buffer = ""
	return function(flush)
		local line, endp, _
		
		if flush then
			line = buffer
			buffer = ""
			return line
		end

		while not line do
			_, endp, line = buffer:find("^(.-)\r?\n")
			if line then
				buffer = buffer:sub(endp+1)
				return line
			elseif #buffer < limit then
				local newblock, code = self:recv(limit - #buffer)
				if not newblock then
					return nil, code
				end
				buffer = buffer .. newblock
			else
				return nil, 0
			end
		end
	end
end