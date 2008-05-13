--[[
FFLuCI - SGI-Module for Haserl

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
module("ffluci.sgi.haserl", package.seeall)
require("ffluci.fs")

-- Environment Table
ffluci.http.env = ENV


-- Returns a table of all COOKIE, GET and POST Parameters
function ffluci.http.formvalues()
	return FORM
end

-- Gets form value from key
function ffluci.http.formvalue(key, default)
	local c = ffluci.http.formvalues()
	
	for match in key:gmatch("[%w-_]+") do
		c = c[match]
		if c == nil then
			return default
		end
	end
	
	return c
end

-- Gets a table of values with a certain prefix
function ffluci.http.formvaluetable(prefix)
	return ffluci.http.formvalue(prefix, {})
end

-- Sends a custom HTTP-Header
function ffluci.http.header(key, value)
	print(key .. ": " .. value)
end

-- Set Content-Type
function ffluci.http.prepare_content(type)
	print("Content-Type: "..type.."\n")
end

-- Asks the browser to redirect to "url"
function ffluci.http.redirect(url)
	ffluci.http.status(302, "Found")
	ffluci.http.header("Location", url)
	print()
end

-- Returns the path of an uploaded file
-- WARNING! File uploads can be easily spoofed! Do additional sanity checks!
function ffluci.http.upload(name)
	local fpath = ffluci.http.formvalue(name)
	local fname = ffluci.http.formvalue(name .. "_name")
	
	if fpath and fname and ffluci.fs.isfile(fpath) then
		return fpath
	end
end

-- Sets HTTP-Status-Header
function ffluci.http.status(code, message)
	print("Status: " .. tostring(code) .. " " .. message)
end
