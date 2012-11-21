--[[
LuCI - HTTP-Interaction

Description:
HTTP-Header manipulator and form variable preprocessor

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

local ltn12 = require "luci.ltn12"
local protocol = require "luci.http.protocol"
local util  = require "luci.util"
local string = require "string"
local coroutine = require "coroutine"
local table = require "table"

local ipairs, pairs, next, type, tostring, error =
	ipairs, pairs, next, type, tostring, error

--- LuCI Web Framework high-level HTTP functions.
module "luci.http"

context = util.threadlocal()

Request = util.class()
function Request.__init__(self, env, sourcein, sinkerr)
	self.input = sourcein
	self.error = sinkerr


	-- File handler
	self.filehandler = function() end

	-- HTTP-Message table
	self.message = {
		env = env,
		headers = {},
		params = protocol.urldecode_params(env.QUERY_STRING or ""),
	}

	self.parsed_input = false
end

function Request.formvalue(self, name, noparse)
	if not noparse and not self.parsed_input then
		self:_parse_input()
	end

	if name then
		return self.message.params[name]
	else
		return self.message.params
	end
end

function Request.formvaluetable(self, prefix)
	local vals = {}
	prefix = prefix and prefix .. "." or "."

	if not self.parsed_input then
		self:_parse_input()
	end

	local void = self.message.params[nil]
	for k, v in pairs(self.message.params) do
		if k:find(prefix, 1, true) == 1 then
			vals[k:sub(#prefix + 1)] = tostring(v)
		end
	end

	return vals
end

function Request.content(self)
	if not self.parsed_input then
		self:_parse_input()
	end

	return self.message.content, self.message.content_length
end

function Request.getcookie(self, name)
  local c = string.gsub(";" .. (self:getenv("HTTP_COOKIE") or "") .. ";", "%s*;%s*", ";")
  local p = ";" .. name .. "=(.-);"
  local i, j, value = c:find(p)
  return value and urldecode(value)
end

function Request.getenv(self, name)
	if name then
		return self.message.env[name]
	else
		return self.message.env
	end
end

function Request.setfilehandler(self, callback)
	self.filehandler = callback
end

function Request._parse_input(self)
	protocol.parse_message_body(
		 self.input,
		 self.message,
		 self.filehandler
	)
	self.parsed_input = true
end

--- Close the HTTP-Connection.
function close()
	if not context.eoh then
		context.eoh = true
		coroutine.yield(3)
	end

	if not context.closed then
		context.closed = true
		coroutine.yield(5)
	end
end

--- Return the request content if the request was of unknown type.
-- @return	HTTP request body
-- @return	HTTP request body length
function content()
	return context.request:content()
end

--- Get a certain HTTP input value or a table of all input values.
-- @param name		Name of the GET or POST variable to fetch
-- @param noparse	Don't parse POST data before getting the value
-- @return			HTTP input value or table of all input value
function formvalue(name, noparse)
	return context.request:formvalue(name, noparse)
end

--- Get a table of all HTTP input values with a certain prefix.
-- @param prefix	Prefix
-- @return			Table of all HTTP input values with given prefix
function formvaluetable(prefix)
	return context.request:formvaluetable(prefix)
end

--- Get the value of a certain HTTP-Cookie.
-- @param name		Cookie Name
-- @return			String containing cookie data
function getcookie(name)
	return context.request:getcookie(name)
end

--- Get the value of a certain HTTP environment variable
-- or the environment table itself.
-- @param name		Environment variable
-- @return			HTTP environment value or environment table
function getenv(name)
	return context.request:getenv(name)
end

--- Set a handler function for incoming user file uploads.
-- @param callback	Handler function
function setfilehandler(callback)
	return context.request:setfilehandler(callback)
end

--- Send a HTTP-Header.
-- @param key	Header key
-- @param value Header value
function header(key, value)
	if not context.headers then
		context.headers = {}
	end
	context.headers[key:lower()] = value
	coroutine.yield(2, key, value)
end

--- Set the mime type of following content data.
-- @param mime	Mimetype of following content
function prepare_content(mime)
	if not context.headers or not context.headers["content-type"] then
		if mime == "application/xhtml+xml" then
			if not getenv("HTTP_ACCEPT") or
			  not getenv("HTTP_ACCEPT"):find("application/xhtml+xml", nil, true) then
				mime = "text/html; charset=UTF-8"
			end
			header("Vary", "Accept")
		end
		header("Content-Type", mime)
	end
end

--- Get the RAW HTTP input source
-- @return	HTTP LTN12 source
function source()
	return context.request.input
end

--- Set the HTTP status code and status message.
-- @param code		Status code
-- @param message	Status message
function status(code, message)
	code = code or 200
	message = message or "OK"
	context.status = code
	coroutine.yield(1, code, message)
end

--- Send a chunk of content data to the client.
-- This function is as a valid LTN12 sink.
-- If the content chunk is nil this function will automatically invoke close.
-- @param content	Content chunk
-- @param src_err	Error object from source (optional)
-- @see close
function write(content, src_err)
	if not content then
		if src_err then
			error(src_err)
		else
			close()
		end
		return true
	elseif #content == 0 then
		return true
	else
		if not context.eoh then
			if not context.status then
				status()
			end
			if not context.headers or not context.headers["content-type"] then
				header("Content-Type", "text/html; charset=utf-8")
			end
			if not context.headers["cache-control"] then
				header("Cache-Control", "no-cache")
				header("Expires", "0")
			end


			context.eoh = true
			coroutine.yield(3)
		end
		coroutine.yield(4, content)
		return true
	end
end

--- Splice data from a filedescriptor to the client.
-- @param fp	File descriptor
-- @param size	Bytes to splice (optional)
function splice(fd, size)
	coroutine.yield(6, fd, size)
end

--- Redirects the client to a new URL and closes the connection.
-- @param url	Target URL
function redirect(url)
	status(302, "Found")
	header("Location", url)
	close()
end

--- Create a querystring out of a table of key - value pairs.
-- @param table		Query string source table
-- @return			Encoded HTTP query string
function build_querystring(q)
	local s = { "?" }

	for k, v in pairs(q) do
		if #s > 1 then s[#s+1] = "&" end

		s[#s+1] = urldecode(k)
		s[#s+1] = "="
		s[#s+1] = urldecode(v)
	end

	return table.concat(s, "")
end

--- Return the URL-decoded equivalent of a string.
-- @param str		URL-encoded string
-- @param no_plus	Don't decode + to " "
-- @return			URL-decoded string
-- @see urlencode
urldecode = protocol.urldecode

--- Return the URL-encoded equivalent of a string.
-- @param str		Source string
-- @return			URL-encoded string
-- @see urldecode
urlencode = protocol.urlencode

--- Send the given data as JSON encoded string.
-- @param data		Data to send
function write_json(x)
	if x == nil then
		write("null")
	elseif type(x) == "table" then
		local k, v
		if type(next(x)) == "number" then
			write("[ ")
			for k, v in ipairs(x) do
				write_json(v)
				if next(x, k) then
					write(", ")
				end
			end
			write(" ]")
		else
			write("{ ")
			for k, v in pairs(x) do
			write("%q: " % k)
				write_json(v)
				if next(x, k) then
					write(", ")
				end
			end
			write(" }")
		end
	elseif type(x) == "number" or type(x) == "boolean" then
		if (x ~= x) then
			-- NaN is the only value that doesn't equal to itself.
			write("Number.NaN")
		else
			write(tostring(x))
		end
	else
		write('"%s"' % tostring(x):gsub('["%z\1-\31]', function(c)
			return '\\u%04x' % c:byte(1)
		end))
	end
end
