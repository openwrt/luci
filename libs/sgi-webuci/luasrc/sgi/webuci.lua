--[[
LuCI - SGI-Module for Haserl

Description:
Server Gateway Interface for Haserl

FileId:
$Id: webuci.lua 2027 2008-05-07 21:16:35Z Cyrus $

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

local status_set = false

-- Initialize the environment
function initenv(env, vars)
	luci.http.env = env
	luci.http.vars = vars
end

-- Enforces user authentification
function luci.http.basic_auth(verify_callback, realm)
	local user = luci.http.env.auth_user
	local pass = luci.http.env.auth_password
	realm = realm or ""
	
	if not user or not verify_callback(user, pass) then
		luci.http.status("401", "Unauthorized")
		luci.http.header("WWW-Authenticate", string.format('Basic realm="%s"', realm))
		return false	
	else
		return true
	end
end

-- Returns the main dispatcher URL
function luci.http.dispatcher()
	return luci.http.env.SCRIPT_NAME or ""
end

-- Returns the upload dispatcher URL
function luci.http.dispatcher_upload()
	-- To be implemented
end

-- Returns a table of all COOKIE, GET and POST Parameters
function luci.http.formvalues()
	return luci.http.vars
end

-- Gets form value from key
function luci.http.formvalue(key, default)
	return luci.http.formvalues()[key] or default
end

-- Gets a table of values with a certain prefix
function luci.http.formvaluetable(prefix)
	local vals = {}
	prefix = prefix and prefix .. "." or "."
	
	for k, v in pairs(luci.http.formvalues()) do
		if k:find(prefix, 1, true) == 1 then
			vals[k:sub(#prefix + 1)] = v
		end
	end
	
	return vals
end

-- Sends a custom HTTP-Header
function luci.http.header(key, value)
	print(key .. ": " .. value)
end

-- Set Content-Type
function luci.http.prepare_content(type)
	if not status_set then
		luci.http.status(200, "OK")
	end
	
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
	-- To be implemented
end

-- Sets HTTP-Status-Header
function luci.http.status(code, message)
	print(luci.http.env.SERVER_PROTOCOL .. " " .. tostring(code) .. " " .. message)
	status_set = true
end
