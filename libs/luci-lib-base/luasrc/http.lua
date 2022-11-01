-- Copyright 2008 Steven Barth <steven@midlink.org>
-- Copyright 2010-2018 Jo-Philipp Wich <jo@mein.io>
-- Licensed to the public under the Apache License 2.0.

local util  = require "luci.util"
local coroutine = require "coroutine"
local table = require "table"
local lhttp = require "lucihttp"

local L, table, ipairs, pairs, type, error = _G.L, table, ipairs, pairs, type, error

module "luci.http"

HTTP_MAX_CONTENT      = 1024*100		-- 100 kB maximum content size

function close()
	L.http:close()
end

function content()
	return L.http:content()
end

function formvalue(name, noparse)
	return L.http:formvalue(name, noparse)
end

function formvaluetable(prefix)
	return L.http:formvaluetable(prefix)
end

function getcookie(name)
	return L.http:getcookie(name)
end

-- or the environment table itself.
function getenv(name)
	return L.http:getenv(name)
end

function setfilehandler(callback)
	return L.http:setfilehandler(callback)
end

function header(key, value)
	L.http:header(key, value)
end

function prepare_content(mime)
	L.http:prepare_content(mime)
end

function source()
	return L.http.input
end

function status(code, message)
	L.http:status(code, message)
end

-- This function is as a valid LTN12 sink.
-- If the content chunk is nil this function will automatically invoke close.
function write(content, src_err)
	if src_err then
		error(src_err)
	end

	return L.print(content)
end

function splice(fd, size)
	coroutine.yield(6, fd, size)
end

function redirect(url)
	L.http:redirect(url)
end

function build_querystring(q)
	local s, n, k, v = {}, 1, nil, nil

	for k, v in pairs(q) do
		s[n+0] = (n == 1) and "?" or "&"
		s[n+1] = util.urlencode(k)
		s[n+2] = "="
		s[n+3] = util.urlencode(v)
		n = n + 4
	end

	return table.concat(s, "")
end

urldecode = util.urldecode

urlencode = util.urlencode

function write_json(x)
	L.printf('%J', x)
end

-- separated by "&". Tables are encoded as parameters with multiple values by
-- repeating the parameter name with each value.
function urlencode_params(tbl)
	local k, v
	local n, enc = 1, {}
	for k, v in pairs(tbl) do
		if type(v) == "table" then
			local i, v2
			for i, v2 in ipairs(v) do
				if enc[1] then
					enc[n] = "&"
					n = n + 1
				end

				enc[n+0] = lhttp.urlencode(k)
				enc[n+1] = "="
				enc[n+2] = lhttp.urlencode(v2)
				n = n + 3
			end
		else
			if enc[1] then
				enc[n] = "&"
				n = n + 1
			end

			enc[n+0] = lhttp.urlencode(k)
			enc[n+1] = "="
			enc[n+2] = lhttp.urlencode(v)
			n = n + 3
		end
	end

	return table.concat(enc, "")
end

context = {
	request = {
		formvalue      = function(self, ...) return formvalue(...)      end;
		formvaluetable = function(self, ...) return formvaluetable(...) end;
		content        = function(self, ...) return content(...)        end;
		getcookie      = function(self, ...) return getcookie(...)      end;
		setfilehandler = function(self, ...) return setfilehandler(...) end;
		message        = L.http.message
	}
}
