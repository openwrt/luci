--[[
FFLuCI - SGI-Module for Haserl

Description:
Server Gateway Interface for Haserl

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
module("ffluci.sgi.haserl", package.seeall)

ENV = ENV or {}
FORM = FORM or {}
require("ffluci.util")

-- HTTP interface

-- Returns a table of all COOKIE, GET and POST Parameters
function ffluci.http.formvalues(prefix)
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


-- Returns the User's IP
function ffluci.http.get_remote_addr()
	return ENV.REMOTE_ADDR
end

-- Returns the script name
function ffluci.http.get_script_name()
	return ENV.SCRIPT_NAME
end


-- Asks the browser to redirect to "url"
function ffluci.http.redirect(url, qs)
	if qs then
		url = url .. "?" .. qs
	end
	
	ffluci.http.set_status(302, "Found")
	print("Location: " .. url .. "\n")
end


-- Set Content-Type
function ffluci.http.set_content_type(type)
	print("Content-Type: "..type.."\n")
end

-- Sets HTTP-Status-Header
function ffluci.http.set_status(code, message)
	print("Status: " .. tostring(code) .. " " .. message)
end
