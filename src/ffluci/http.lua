--[[
FFLuCI - HTTP-Interaction

Description:
HTTP-Header manipulator and form variable preprocessor

FileId:
$Id$

ToDo:
- Cookie handling

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

module("ffluci.http", package.seeall)

require("ffluci.util")

-- Sets HTTP-Status-Header
function status(code, message)
	print("Status: " .. tostring(code) .. " " .. message)
end


-- Asks the browser to redirect to "url"
function redirect(url)
	status(302, "Found")
	print("Location: " .. url .. "\n")
end


-- Same as redirect but accepts category, module and action for internal use
function request_redirect(category, module, action)
	category = category or "public"
	module   = module   or "index"
	action   = action   or "index"
	
	local pattern = os.getenv("SCRIPT_NAME") .. "/%s/%s/%s"
	redirect(pattern:format(category, module, action))
end

-- Gets form value from key
function formvalue(key, default)
	local c = formvalues()
	
	for match in key:gmatch("%w+") do
		c = c[match]
		if c == nil then
			return default
		end
	end
	
	return c
end


-- Returns a table of all COOKIE, GET and POST Parameters
function formvalues()
	return FORM
end


-- Prints plaintext content-type header
function textheader()
	print("Content-Type: text/plain\n")
end


-- Prints html content-type header
function htmlheader()
	print("Content-Type: text/html\n")
end


-- Prints xml content-type header
function xmlheader()
	print("Content-Type: text/xml\n")
end
