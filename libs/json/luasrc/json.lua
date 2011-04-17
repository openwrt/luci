--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>
Copyright 2008 Jo-Philipp Wich <xm@leipzig.freifunk.net>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

$Id$

Decoder:
	Info:
		null will be decoded to luci.json.null if first parameter of Decoder() is true
	
	Example:
		decoder = luci.json.Decoder()
		luci.ltn12.pump.all(luci.ltn12.source.string("decodableJSON"), decoder:sink())
		luci.util.dumptable(decoder:get())
		
	Known issues:
		does not support unicode conversion \uXXYY with XX != 00 will be ignored
		
			
Encoder:
	Info:
		Accepts numbers, strings, nil, booleans as they are
		Accepts luci.json.null as replacement for nil
		Accepts full associative and full numerically indexed tables
		Mixed tables will loose their associative values during conversion
		Iterator functions will be encoded as an array of their return values
		Non-iterator functions will probably corrupt the encoder
	
	Example:
		encoder = luci.json.Encoder(encodableData)
		luci.ltn12.pump.all(encoder:source(), luci.ltn12.sink.file(io.open("someFile", w)))
]]--

local util      = require "luci.util"
local table     = require "table"
local string    = require "string"
local coroutine = require "coroutine"

local assert    = assert
local tonumber  = tonumber
local tostring  = tostring
local error     = error
local type	    = type
local pairs	    = pairs
local ipairs    = ipairs
local next      = next
local pcall		= pcall

local getmetatable = getmetatable

--- LuCI JSON-Library
-- @cstyle	instance
module "luci.json"


--- Directly decode a JSON string
-- @param json JSON-String
-- @return Lua object
function decode(json, ...)
	local a = ActiveDecoder(function() return nil end, ...)
	a.chunk = json
	local s, obj = pcall(a.get, a)
	return s and obj or nil
end


--- Direcly encode a Lua object into a JSON string.
-- @param obj Lua Object
-- @return JSON string
function encode(obj, ...)
	local out = {}
	local e = Encoder(obj, 1, ...):source()
	local chnk, err
	repeat
		chnk, err = e()
		out[#out+1] = chnk
	until not chnk
	return not err and table.concat(out) or nil
end


--- Null replacement function
-- @return null
function null()
	return null
end

--- Create a new JSON-Encoder.
-- @class	function
-- @name	Encoder
-- @param data			Lua-Object to be encoded.
-- @param buffersize	Blocksize of returned data source.
-- @param fastescape	Use non-standard escaping (don't escape control chars) 
-- @return JSON-Encoder
Encoder = util.class()

function Encoder.__init__(self, data, buffersize, fastescape)
	self.data = data
	self.buffersize = buffersize or 512
	self.buffer = ""
	self.fastescape = fastescape
	
	getmetatable(self).__call = Encoder.source
end

--- Create an LTN12 source providing the encoded JSON-Data.
-- @return LTN12 source
function Encoder.source(self)
	local source = coroutine.create(self.dispatch)
	return function()
		local res, data = coroutine.resume(source, self, self.data, true)
		if res then
			return data
		else
			return nil, data
		end
	end	
end

function Encoder.dispatch(self, data, start)
	local parser = self.parsers[type(data)]
	
	parser(self, data)
	
	if start then
		if #self.buffer > 0 then
			coroutine.yield(self.buffer)
		end
		
		coroutine.yield()
	end
end

function Encoder.put(self, chunk)
	if self.buffersize < 2 then
		coroutine.yield(chunk)
	else
		if #self.buffer + #chunk > self.buffersize then
			local written = 0
			local fbuffer = self.buffersize - #self.buffer

			coroutine.yield(self.buffer .. chunk:sub(written + 1, fbuffer))
			written = fbuffer
			
			while #chunk - written > self.buffersize do
				fbuffer = written + self.buffersize
				coroutine.yield(chunk:sub(written + 1, fbuffer))
				written = fbuffer
			end 
			
			self.buffer = chunk:sub(written + 1)
		else
			self.buffer = self.buffer .. chunk
		end
	end
end

function Encoder.parse_nil(self)
	self:put("null")
end

function Encoder.parse_bool(self, obj)
	self:put(obj and "true" or "false")
end

function Encoder.parse_number(self, obj)
	self:put(tostring(obj))
end

function Encoder.parse_string(self, obj)
	if self.fastescape then
		self:put('"' .. obj:gsub('\\', '\\\\'):gsub('"', '\\"') .. '"')
	else
		self:put('"' ..
			obj:gsub('[%c\\"]',
				function(char)
					return '\\u00%02x' % char:byte()
				end
			)
		.. '"')
	end
end

function Encoder.parse_iter(self, obj)
	if obj == null then
		return self:put("null")
	end

	if type(obj) == "table" and (#obj == 0 and next(obj)) then
		self:put("{")
		local first = true
		
		for key, entry in pairs(obj) do
			first = first or self:put(",")
			first = first and false
			self:parse_string(tostring(key))
			self:put(":")
			self:dispatch(entry)
		end
		
		self:put("}") 		
	else
		self:put("[")
		local first = true
		
		if type(obj) == "table" then
			for i=1, #obj do
				first = first or self:put(",")
				first = first and nil
				self:dispatch(obj[i])
			end
		else
			for entry in obj do
				first = first or self:put(",")
				first = first and nil
				self:dispatch(entry)
			end		
		end
		
		self:put("]") 	
	end
end

Encoder.parsers = {
	['nil']      = Encoder.parse_nil,
	['table']    = Encoder.parse_iter,
	['number']   = Encoder.parse_number,
	['string']   = Encoder.parse_string,
	['boolean']  = Encoder.parse_bool,
	['function'] = Encoder.parse_iter
} 


--- Create a new JSON-Decoder.
-- @class	function
-- @name	Decoder
-- @param customnull Use luci.json.null instead of nil for decoding null
-- @return JSON-Decoder
Decoder = util.class()

function Decoder.__init__(self, customnull)
	self.cnull = customnull
	getmetatable(self).__call = Decoder.sink
end

--- Create an LTN12 sink from the decoder object which accepts the JSON-Data.
-- @return LTN12 sink
function Decoder.sink(self)
	local sink = coroutine.create(self.dispatch)
	return function(...)
		return coroutine.resume(sink, self, ...)
	end
end


--- Get the decoded data packets after the rawdata has been sent to the sink.
-- @return Decoded data
function Decoder.get(self)
	return self.data
end

function Decoder.dispatch(self, chunk, src_err, strict)
	local robject, object
	local oset = false
	 
	while chunk do
		while chunk and #chunk < 1 do
			chunk = self:fetch()
		end
		
		assert(not strict or chunk, "Unexpected EOS")
		if not chunk then break end
		
		local char   = chunk:sub(1, 1)
		local parser = self.parsers[char]
		 or (char:match("%s")     and self.parse_space)
		 or (char:match("[0-9-]") and self.parse_number)
		 or error("Unexpected char '%s'" % char)
		
		chunk, robject = parser(self, chunk)
		
		if parser ~= self.parse_space then
			assert(not oset, "Scope violation: Too many objects")
			object = robject
			oset = true
		
			if strict then
				return chunk, object
			end
		end
	end
	
	assert(not src_err, src_err)
	assert(oset, "Unexpected EOS")
	
	self.data = object
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
	return self:parse_literal(chunk, "null", self.cnull and null)
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
	elseif char == "u" then
		chunk = self:fetch_atleast(chunk, 4)
		local s1, s2 = chunk:sub(1, 2), chunk:sub(3, 4)
		s1, s2 = tonumber(s1, 16), tonumber(s2, 16)
		assert(s1 and s2, "Invalid Unicode character")
		
		-- ToDo: Unicode support
		return chunk:sub(5), s1 == 0 and string.char(s2) or ""
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
	else
		error("Unexpected escaping sequence '\\%s'" % char)
	end
end


function Decoder.parse_array(self, chunk)
	chunk = chunk:sub(2)
	local array = {}
	local nextp = 1
	
	local chunk, object = self:parse_delimiter(chunk, "%]")
	
	if object then
		return chunk, array
	end
	
	repeat
		chunk, object = self:dispatch(chunk, nil, true)
		table.insert(array, nextp, object)
		nextp = nextp + 1
		
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


Decoder.parsers = { 
	['"'] = Decoder.parse_string,
	['t'] = Decoder.parse_true,
	['f'] = Decoder.parse_false,
	['n'] = Decoder.parse_null,
	['['] = Decoder.parse_array,
	['{'] = Decoder.parse_object
}


--- Create a new Active JSON-Decoder.
-- @class	function
-- @name	ActiveDecoder
-- @param   customnull	Use luci.json.null instead of nil for decoding null
-- @return  Active JSON-Decoder
ActiveDecoder = util.class(Decoder)

function ActiveDecoder.__init__(self, source, customnull)
	Decoder.__init__(self, customnull)
	self.source = source
	self.chunk = nil
	getmetatable(self).__call = self.get
end


--- Fetches one JSON-object from given source
-- @return Decoded object
function ActiveDecoder.get(self)
	local chunk, src_err, object
	if not self.chunk then
		chunk, src_err = self.source()
	else
		chunk = self.chunk
	end

	self.chunk, object = self:dispatch(chunk, src_err, true)
	return object
end


function ActiveDecoder.fetch(self)
	local chunk, src_err = self.source()
	assert(chunk or not src_err, src_err)
	return chunk
end
