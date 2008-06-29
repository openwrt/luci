--[[
LuCI - HTTP-Interaction

Description:
HTTP-Header manipulator and form variable preprocessor

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

module("luci.http", package.seeall)
local ltn12 = require("luci.ltn12")
require("luci.http.protocol")
require("luci.util")

context = luci.util.threadlocal()


Request = luci.util.class()
function Request.__init__(self, env, sourcein, sinkerr)
	self.input = sourcein
	self.error = sinkerr


	-- File handler
	self.filehandler = function() end
	
	-- HTTP-Message table
	self.message = {
		env = env,
		headers = {},
		params = luci.http.protocol.urldecode_params(env.QUERY_STRING or ""),
	}
	
	self.parsed_input = false
end

function Request.formvalue(self, name)
	if not self.parsed_input then
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
	luci.http.protocol.parse_message_body(
		 self.input,
		 self.message,
		 self.filehandler
	)
	self.parsed_input = true
end


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

function formvalue(...)
	return context.request:formvalue(...)
end

function formvaluetable(...)
	return context.request:formvaluetable(...)
end

function getcookie(...)
	return context.request:getcookie(...)
end

function getvalue(...)
	return context.request:getvalue(...)
end

function postvalue(...)
	return context.request:postvalue(...)
end

function getenv(...)
	return context.request:getenv(...)
end

function setfilehandler(...)
	return context.request:setfilehandler(...)
end

function header(key, value)
	if not context.headers then
		context.headers = {}
	end
	context.headers[key:lower()] = value
	coroutine.yield(2, key, value)
end

function prepare_content(mime)
	header("Content-Type", mime)
end

function status(code, message)
	code = code or 200
	message = message or "OK"
	context.status = code
	coroutine.yield(1, code, message)
end

function write(content)
	if not content or #content == 0 then
		return
	end
	if not context.eoh then
		if not context.status then
			status()
		end
		if not context.headers or not context.headers["content-type"] then
			header("Content-Type", "text/html; charset=utf-8")
		end
		
		context.eoh = true
		coroutine.yield(3)
	end
	coroutine.yield(4, content)
end

function redirect(url)
	status(302, "Found")
	header("Location", url)
	close()
end

function build_querystring(table)
	local s="?"
	
	for k, v in pairs(table) do
		s = s .. urlencode(k) .. "=" .. urlencode(v) .. "&"
	end
	
	return s
end

urldecode = luci.http.protocol.urldecode
urlencode = luci.http.protocol.urlencode
