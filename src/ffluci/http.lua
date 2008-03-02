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

-- Form validation function:
-- Gets a form variable "key".
-- If it does not exist: return "default"
-- If cast_number is true and "key" is not a number: return "default"
-- If valid is a table and "key" is not in it: return "default"
-- If valid is a function and returns nil: return "default"
-- Else return the value of "key"
--
-- Examples:
-- Get a form variable "foo" and return "bar" if it is not set
-- 		= formvalue("foo", "bar")
--
-- Get "foo" and make sure it is either "bar" or "baz"
--      = formvalue("foo", nil, nil, {"bar", "baz"})
--
-- Get "foo", make sure its a number and below 10 else return 5
--      = formvalue("foo", 5, true, function(a) return a < 10 and a or nil end)
function formvalue(key, default, cast_number, valid, table)
	table = table or formvalues()
	
	if table[key] == nil then
		return default
	else
		local value = table[key]
	
		value = cast_number and tonumber(value) or not cast_number and nil
		
		if type(valid) == "function" then
			value = valid(value)
		elseif type(valid) == "table" then
			if not ffluci.util.contains(valid, value) then
				value = nil
			end
		end
		
		return value or default
	end
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
