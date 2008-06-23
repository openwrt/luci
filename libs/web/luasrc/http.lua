--[[
LuCI - HTTP-Interaction

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

module("luci.http", package.seeall)
require("ltn12")
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
	
	setmetatable(self.message.params, {__index =
		function(tbl, key)
			setmetatable(tbl, nil)

			luci.http.protocol.parse_message_body(
			 self.input,
			 self.message,
			 self.filehandler
			)

			return rawget(tbl, key)
		end
	})
end

function Request.formvalue(self, name, default)
	if name then
		return self.message.params[name] and tostring(self.message.params[name]) or default
	else
		return self.message.params
	end
end

function Request.formvaluetable(self, prefix)
	local vals = {}
	prefix = prefix and prefix .. "." or "."
	
	local void = self.message.params[nil]
	for k, v in pairs(self.message.params) do
		if k:find(prefix, 1, true) == 1 then
			vals[k:sub(#prefix + 1)] = tostring(v)
		end
	end
	
	return vals
end

function Request.getenv(self, name)
	return name and self.message.env[name] or self.message.env
end

function Request.setfilehandler(self, callback)
	self.filehandler = callback
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
	if not context.status then
		status()
	end
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


function basic_auth(realm, errorpage)
	header("Status", "401 Unauthorized")
	header("WWW-Authenticate", string.format('Basic realm="%s"', realm or ""))
	
	if errorpage then
		errorpage()
	end
	
	close()
end

function redirect(url)
	header("Status", "302 Found")
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
