--[[
LuCI - SGI-Module for Webuci

Description:
Server Gateway Interface for Webuci

FileId:
$Id$

License:
Copyright 2008 Steven Barth <steven@midlink.org>

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
module("luci.sgi.webuci", package.seeall)
local ltn12 = require("luci.ltn12")
require("luci.http")
require("luci.util")
require("luci.dispatcher")

function run(env, vars)
	local r = luci.http.Request(
		env,
		ltn12.source.empty(),
		ltn12.sink.file(io.stderr)
	)
	
	r.message.params = vars
	
	local x = coroutine.create(luci.dispatcher.httpdispatch)
	local status = ""
	local headers = {}
	local active = true
	
	while coroutine.status(x) ~= "dead" do
		local res, id, data1, data2 = coroutine.resume(x, r)

		if not res then
			print(env.SERVER_PROTOCOL .. " 500 Internal Server Error")
			print("Content-Type: text/plain\n")
			print(id)
			break;
		end
		
		if active then
			if id == 1 then
				status = env.SERVER_PROTOCOL .. " " .. tostring(data1) .. " " .. data2 .. "\r\n"
			elseif id == 2 then
				headers[data1] = data2
			elseif id == 3 then
				io.write(status)
				for k, v in pairs(headers) do
					io.write(k .. ": " .. v .. "\r\n")
				end
				io.write("\r\n")
			elseif id == 4 then
				io.write(data1)
			elseif id == 5 then
				active = false
			end
		end
	end
end
