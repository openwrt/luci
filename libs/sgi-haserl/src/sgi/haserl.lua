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
require("luci.fs")

-- Environment Table
luci.http.env = ENV

-- Returns the main dispatcher URL
function luci.http.dispatcher()
	return luci.http.env.SCRIPT_NAME or ""
end

-- Returns the upload dispatcher URL
function luci.http.dispatcher_upload()
	return luci.http.dispatcher() .. "-upload"
end

-- Returns a table of all COOKIE, GET and POST Parameters
function luci.http.formvalues()
	return FORM
end

-- Gets form value from key
function luci.http.formvalue(key, default)
	local c = luci.http.formvalues()
	
	for match in key:gmatch("[%w-_]+") do
		c = c[match]
		if c == nil then
			return default
		end
	end
	
	return c
end

-- Gets a table of values with a certain prefix
function luci.http.formvaluetable(prefix)
	return luci.http.formvalue(prefix, {})
end

-- Sends a custom HTTP-Header
function luci.http.header(key, value)
	print(key .. ": " .. value)
end

-- Set Content-Type
function luci.http.prepare_content(type)
	print("Content-Type: "..type.."\n")
end

-- Asks the browser to redirect to "url"
function luci.http.redirect(url)
	luci.http.status(302, "Found")
	luci.http.header("Location", url)
	print()
end

-- Returns the path of an uploaded file
-- WARNING! File uploads can be easily spoofed! Do additional sanity checks!
function luci.http.upload(name)
	local fpath = luci.http.formvalue(name)
	local fname = luci.http.formvalue(name .. "_name")
	
	if fpath and fname and luci.fs.isfile(fpath) then
		return fpath
	end
end

-- Sets HTTP-Status-Header
function luci.http.status(code, message)
	print("Status: " .. tostring(code) .. " " .. message)
end
