--[[
LuCI - Lua Development Framework 

Copyright 2009 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--

require "nixio.util"
local nixio = require "nixio"
local httpclient = require "luci.httpclient"
local ltn12 = require "luci.ltn12"

local print = print

module "luci.httpclient.receiver"

local function prepare_fd(target)
	-- Open fd for appending
	local file, code, msg = nixio.open(target, "r+")
	if not file and code == nixio.const.ENOENT then
		file, code, msg = nixio.open(target, "w")
		if file then
			file:flush()
		end
	end
	if not file then
		return file, code, msg
	end
	
	-- Acquire lock
	local stat, code, msg = file:lock("ex", "nb")
	if not stat then
		return stat, code, msg
	end
	
	file:seek(0, "end") 
	
	return file
end


function request_to_file(uri, target, options, cbs)
	options = options or {}
	cbs = cbs or {}
	options.headers = options.headers or {}
	local hdr = options.headers
	
	local file, code, msg = prepare_fd(target)
	if not file then
		return file, code, msg
	end
	
	local off = file:tell()
	
	-- Set content range
	if off > 0 then
		hdr.Range = hdr.Range or ("bytes=" .. off .. "-")  
	end
	
	local code, resp, buffer, sock = httpclient.request_raw(uri, options)
	if not code then
		-- No success
		file:close()
		return code, resp, buffer
	elseif hdr.Range and code ~= 206 then
		-- We wanted a part but we got the while file
		sock:close()
		file:close()
		return nil, -4, code, resp
	elseif not hdr.Range and code ~= 200 then
		-- We encountered an error
		sock:close()
		file:close()
		return nil, -4, code, resp
	end
	
	if cbs.on_header then
		cbs.on_header(file, code, resp)
	end

	local chunked = resp.headers["Transfer-Encoding"] == "chunked"

	-- Write the buffer to file
	file:writeall(buffer)
	print ("Buffered data: " .. #buffer .. " Byte")
	
	repeat
		if not sock:is_socket() or chunked then
			break
		end
		
		-- This is a plain TCP socket and there is no encoding so we can splice
	
		local pipein, pipeout, msg = nixio.pipe()
		if not pipein then
			sock:close()
			file:close()
			return pipein, pipeout, msg
		end
		
		
		-- Disable blocking for the pipe otherwise we might end in a deadlock
		local stat, code, msg = pipein:setblocking(false)
		if stat then
			stat, code, msg = pipeout:setblocking(false)
		end
		if not stat then
			sock:close()
			file:close()
			return stat, code, msg
		end
		
		
		-- Adjust splice values
		local ssize = 65536
		local smode = nixio.splice_flags("move", "more", "nonblock")
		
		local stat, code, msg = nixio.splice(sock, pipeout, ssize, smode)
		if stat == nil then
			break
		end
		
		local pollsock = {
			{fd=sock, events=nixio.poll_flags("in")}
		}
		
		local pollfile = {
			{fd=file, events=nixio.poll_flags("out")}
		}
		
		local done
		
		repeat
			-- Socket -> Pipe
			repeat
				nixio.poll(pollsock, 15000)
			
				stat, code, msg = nixio.splice(sock, pipeout, ssize, smode)
				if stat == nil then
					sock:close()
					file:close()
					return stat, code, msg
				elseif stat == 0 then
					done = true
					break
				end
			until stat == false
			
			-- Pipe -> File
			repeat
				nixio.poll(pollfile, 15000)
			
				stat, code, msg = nixio.splice(pipein, file, ssize, smode)
				if stat == nil then
					sock:close()
					file:close()
					return stat, code, msg
				end
			until stat == false
			
			if cbs.on_write then
				cbs.on_write(file)
			end
		until done
		
		file:close()
		sock:close()
		return true
	until true
	
	print "Warning: splice() failed, falling back to read/write mode"
	
	local src = chunked and httpclient.chunksource(sock) or sock:blocksource()
	local snk = file:sink()
	
	if cbs.on_write then
		src = ltn12.source.chain(src, function(chunk)
			cbs.on_write(file)
			return chunk
		end)
	end
	
	-- Fallback to read/write
	local stat, code, msg = ltn12.pump.all(src, snk)
	if stat then
		file:close()
		sock:close()
	end
	return stat, code, msg
end