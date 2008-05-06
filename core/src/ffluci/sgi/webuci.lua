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
module("ffluci.sgi.webuci", package.seeall)

local status_set = false

-- HTTP interface

-- Returns a table of all COOKIE, GET and POST Parameters
function ffluci.http.formvalues()
	return webuci.vars
end

-- Gets form value from key
function ffluci.http.formvalue(key, default)
	return ffluci.http.formvalues()[key] or default
end

-- Gets a table of values with a certain prefix
function ffluci.http.formvaluetable(prefix)
	local vals = {}
	prefix = prefix and prefix .. "." or "."
	
	for k, v in pairs(ffluci.http.formvalues()) do
		if k:find(prefix, 1, true) == 1 then
			vals[k:sub(#prefix + 1)] = v
		end
	end
	
	return vals
end

-- Returns the path info
function ffluci.http.get_path_info()
	return webuci.PATH_INFO
end

-- Returns the User's IP
function ffluci.http.get_remote_addr()
	return webuci.REMOTE_ADDR
end

-- Returns the request URI
function ffluci.http.get_request_uri()
	return webuci.REQUEST_URI
end


-- Returns the script name
function ffluci.http.get_script_name()
	return webuci.SCRIPT_NAME
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
	if not status_set then
		ffluci.http.set_status(200, "OK")
	end
	
	print("Content-Type: "..type.."\n")
end

-- Sets HTTP-Status-Header
function ffluci.http.set_status(code, message)
	print(webuci.SERVER_PROTOCOL .. " " .. tostring(code) .. " " .. message)
	status_set = true
end
