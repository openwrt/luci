--[[
LuCI - SGI-Module for Haserl

Description:
Server Gateway Interface for Haserl

FileId:
$Id: haserl.lua 2027 2008-05-07 21:16:35Z Cyrus $

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
module("luci.sgi.haserl", package.seeall)
require("luci.http")
require("luci.util")
require("luci.dispatcher")

function run()
	local r = luci.http.Request()
	r.env = ENV
	r.request = normalize_table(FORM)
	
	local x = coroutine.create(luci.dispatcher.httpdispatch)
	while coroutine.status(x) ~= "dead" do
		local res, id, data1, data2 = coroutine.resume(x, r)
		
		if not res then
			print("Status: 500 Internal Server Error")
			print("Content-Type: text/plain\n")
			print(id)
			break;
		end
		
		if id == 1 then
			io.write("Status: " .. tostring(data1) .. " " .. data2 .. "\n")
		elseif id == 2 then
			io.write(data1 .. ": " .. data2 .. "\n")
		elseif id == 3 then
			io.write("\n")
		elseif id == 4 then
			io.write(data1)
		end
	end
end

function normalize_table(table, prefix)
	prefix = prefix and prefix .. "." or ""
	local new = {}
	
	for k,v in pairs(table) do
		if type(v) == "table" and #v == 0 then
			luci.util.update(new, normalize_table(v, prefix .. k))
		else
			new[prefix .. k] = v
		end
	end
	
	return new
end
