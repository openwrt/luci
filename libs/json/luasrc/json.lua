--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>
Copyright 2008 Jo-Philipp Wich <xm@leipzig.freifunk.net>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--

local util      = require "luci.util"
local ltn12     = require "luci.ltn12"
local table     = require "table"
local coroutine = require "coroutine"

local assert    = assert
local tonumber  = tonumber
local error     = error

module "luci.json"

--- Null replacement function
-- @return null
function null()
	return null
end

Decoder = util.class()

--- Create an LTN12 sink from the decoder object
-- @return LTN12 sink
function Decoder.sink(self)
	local sink = coroutine.create(self.dispatch)
	return function(...)
		return coroutine.resume(sink, self, ...)
	end
end


--- Get the decoded data packets
-- @return Decoded data
function Decoder.get(self)
	return self.data
end


function Decoder.dispatch(self, chunk, src_err, strict)
	local robject, object
	 
	while chunk do
		if #chunk < 1 then
			chunk = self:fetch()
		end
		
		assert(not strict or chunk, "Unexpected EOS")
		if not chunk then
			break
		end
		
		local parser = nil
		local char   = chunk:sub(1, 1)
		
		if char == '"' then
			parser = self.parse_string
		elseif char == 't' then
			parser = self.parse_true
		elseif char == 'f' then
			parser = self.parse_false
		elseif char == 'n' then
			parser = self.parse_null
		elseif char == '[' then
			parser = self.parse_array
		elseif char == '{' then
			parser = self.parse_object
		elseif char:match("%s") then
			parser = self.parse_space
		elseif char:match("[0-9-]") then
			parser = self.parse_number
		end
		
		if parser then
			chunk, robject = parser(self, chunk)
			
			if robject ~= nil then
				assert(object == nil, "Scope violation: Too many objects")
				object = robject
			end
			
			if strict and object ~= nil then
				return chunk, object
			end
		else
			error("Unexpected char '%s'" % char)
		end
	end
	
	assert(not src_err, src_err)
	assert(object ~= nil, "Unexpected EOS")
	
	self.data = object
	return chunk, object
end


function Decoder.fetch(self)
	local tself, chunk, src_err = coroutine.yield()
	assert(chunk or not src_err, src_err)
	return chunk
end


function Decoder.fetch_atleast(self, chunk, bytes)
	while #chunk < bytes do
		local nchunk = self:fetch()
		assert(nchunk, "Unexpected EOS")
		chunk = chunk .. nchunk
	end
	
	return chunk
end


function Decoder.fetch_until(self, chunk, pattern)
	local start = chunk:find(pattern)

	while not start do
		local nchunk = self:fetch()
		assert(nchunk, "Unexpected EOS")
		chunk = chunk .. nchunk
		start = chunk:find(pattern)
	end

	return chunk, start
end


function Decoder.parse_space(self, chunk)
	local start = chunk:find("[^%s]")
	
	while not start do
		chunk = self:fetch()
		if not chunk then
			return nil
		end
		start = chunk:find("[^%s]")
	end
	
	return chunk:sub(start)
end


function Decoder.parse_literal(self, chunk, literal, value)
	chunk = self:fetch_atleast(chunk, #literal)	
	assert(chunk:sub(1, #literal) == literal, "Invalid character sequence")
	return chunk:sub(#literal + 1), value
end


function Decoder.parse_null(self, chunk)
	return self:parse_literal(chunk, "null", null)
end


function Decoder.parse_true(self, chunk)
	return self:parse_literal(chunk, "true", true)
end


function Decoder.parse_false(self, chunk)
	return self:parse_literal(chunk, "false", false)
end


function Decoder.parse_number(self, chunk)
	local chunk, start = self:fetch_until(chunk, "[^0-9eE.+-]")
	local number = tonumber(chunk:sub(1, start - 1))
	assert(number, "Invalid number specification")
	return chunk:sub(start), number
end


function Decoder.parse_string(self, chunk)
	local str = ""
	local object = nil
	assert(chunk:sub(1, 1) == '"', 'Expected "')
	chunk = chunk:sub(2)

	while true do
		local spos = chunk:find('[\\"]')
		if spos then
			str = str .. chunk:sub(1, spos - 1)
			
			local char = chunk:sub(spos, spos)
			if char == '"' then				-- String end
				chunk = chunk:sub(spos + 1)
				break
			elseif char == "\\" then 		-- Escape sequence
				chunk, object = self:parse_escape(chunk:sub(spos))
				str = str .. object
			end
		else
			str = str .. chunk
			chunk = self:fetch()
			assert(chunk, "Unexpected EOS while parsing a string")		
		end
	end

	return chunk, str
end


function Decoder.parse_escape(self, chunk)
	local str = ""
	chunk = self:fetch_atleast(chunk:sub(2), 1)
	local char = chunk:sub(1, 1)
	chunk = chunk:sub(2)
	
	if char == '"' then
		return chunk, '"'
	elseif char == "\\" then
		return chunk, "\\"
	elseif char == "/" then
		return chunk, "/"
	elseif char == "b" then
		return chunk, "\b"
	elseif char == "f" then
		return chunk, "\f"
	elseif char == "n" then
		return chunk, "\n"
	elseif char == "r" then
		return chunk, "\r"
	elseif char == "t" then
		return chunk, "\t"
	elseif char == "u" then
		chunk = self:fetch_atleast(chunk, 4)
		local s1, s2 = chunk:sub(1, 4):match("^([0-9a-fA-F][0-9a-fA-F])([0-9a-fA-F][0-9a-fA-F])$")
		assert(s1 and s2, "Invalid Unicode character 'U+%s%s'" % {s1, s2})
		s1, s2 = tonumber(s1, 16), tonumber(s2, 16)
		
		-- ToDo: Unicode support
		return chunk:sub(5), s1 == 0 and s2 or ""
	else
		error("Unexpected escaping sequence '\\%s'" % char)
	end
end


function Decoder.parse_array(self, chunk)
	chunk = chunk:sub(2)
	local array = {}
	
	local chunk, object = self:parse_delimiter(chunk, "%]")
	
	if object then
		return chunk, array
	end
	
	repeat
		chunk, object = self:dispatch(chunk, nil, true)
		table.insert(array, object)
		
		chunk, object = self:parse_delimiter(chunk, ",%]")
		assert(object, "Delimiter expected")
	until object == "]"

	return chunk, array
end


function Decoder.parse_object(self, chunk)
	chunk = chunk:sub(2)
	local array = {}
	local name

	local chunk, object = self:parse_delimiter(chunk, "}")

	if object then
		return chunk, array
	end

	repeat
		chunk = self:parse_space(chunk)
		assert(chunk, "Unexpected EOS")
		
		chunk, name   = self:parse_string(chunk)
		
		chunk, object = self:parse_delimiter(chunk, ":")
		assert(object, "Separator expected")
		
		chunk, object = self:dispatch(chunk, nil, true)
		array[name] = object

		chunk, object = self:parse_delimiter(chunk, ",}")
		assert(object, "Delimiter expected")
	until object == "}"

	return chunk, array
end


function Decoder.parse_delimiter(self, chunk, delimiter)
	while true do
		chunk = self:fetch_atleast(chunk, 1)
		local char = chunk:sub(1, 1)
		if char:match("%s") then
			chunk = self:parse_space(chunk)
			assert(chunk, "Unexpected EOS")
		elseif char:match("[%s]" % delimiter) then
			return chunk:sub(2), char
		else
			return chunk, nil
		end
	end
end