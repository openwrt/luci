--[[
LuCI - Server Gateway Interface for the uHTTPd server

Copyright 2010 Jo-Philipp Wich <xm@subsignal.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at 

	http://www.apache.org/licenses/LICENSE-2.0 

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

]]--

require "nixio.util"
require "luci.http"
require "luci.sys"
require "luci.dispatcher"
require "luci.ltn12"

function handle_request(env)
	exectime = os.clock()
	local renv = {
		CONTENT_LENGTH  = env.CONTENT_LENGTH,
		CONTENT_TYPE    = env.CONTENT_TYPE,
		REQUEST_METHOD  = env.REQUEST_METHOD,
		REQUEST_URI     = env.REQUEST_URI,
		PATH_INFO	= env.PATH_INFO,
		SCRIPT_NAME     = env.SCRIPT_NAME:gsub("/+$", ""),
		SCRIPT_FILENAME = env.SCRIPT_NAME,
		SERVER_PROTOCOL = env.SERVER_PROTOCOL,
		QUERY_STRING    = env.QUERY_STRING
	}

	local k, v
	for k, v in pairs(env.headers) do
		k = k:upper():gsub("%-", "_")
		renv["HTTP_" .. k] = v
	end

	local len = env.CONTENT_LENGTH or 0
	local function recv()
		if len > 0 then
			local rlen, rbuf = uhttpd.recv(4096)
			if rlen >= 0 then
				len = len - rlen
				return rbuf
			end
		end
		return nil
	end

	local function send(...)
		return uhttpd.send(...)
	end

	local function sendc(...)
		if env.HTTP_VERSION > 1.0 then
			return uhttpd.sendc(...)
		else
			return uhttpd.send(...)
		end
	end

	local req = luci.http.Request(
		renv, recv, luci.ltn12.sink.file(io.stderr)
	)
	

	local x = coroutine.create(luci.dispatcher.httpdispatch)
	local hcache = { }
	local active = true

	if env.HTTP_VERSION > 1.0 then
		hcache["Transfer-Encoding"] = "chunked"
	end

	while coroutine.status(x) ~= "dead" do
		local res, id, data1, data2 = coroutine.resume(x, req)

		if not res then
			send(env.SERVER_PROTOCOL)
			send(" 500 Internal Server Error\r\n")
			send("Content-Type: text/plain\r\n\r\n")
			send(tostring(id))
			break
		end

		if active then
			if id == 1 then
				send(env.SERVER_PROTOCOL)
				send(" ")
				send(tostring(data1))
				send(" ")
				send(tostring(data2))
				send("\r\n")
			elseif id == 2 then
				hcache[data1] = data2
			elseif id == 3 then
				for k, v in pairs(hcache) do
					send(tostring(k))
					send(": ")
					send(tostring(v))
					send("\r\n")
				end
				send("\r\n")
			elseif id == 4 then
				sendc(tostring(data1 or ""))
			elseif id == 5 then
				active = false
			elseif id == 6 then
				data1:copyz(nixio.stdout, data2)
			end
		end
	end
end
