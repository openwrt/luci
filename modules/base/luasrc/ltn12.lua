--[[
LuaSocket 2.0.2 license
Copyright � 2004-2007 Diego Nehab

Permission is hereby granted, free of charge, to any person obtaining a
copy of this software and associated documentation files (the "Software"),
to deal in the Software without restriction, including without limitation
the rights to use, copy, modify, merge, publish, distribute, sublicense,
and/or sell copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
DEALINGS IN THE SOFTWARE.
]]--
--[[
	Changes made by LuCI project:
		* Renamed to luci.ltn12 to avoid collisions with luasocket
		* Added inline documentation
]]--
-----------------------------------------------------------------------------
-- LTN12 - Filters, sources, sinks and pumps.
-- LuaSocket toolkit.
-- Author: Diego Nehab
-- RCS ID: $Id$
-----------------------------------------------------------------------------

-----------------------------------------------------------------------------
-- Declare module
-----------------------------------------------------------------------------
local string = require("string")
local table = require("table")
local base = _G

--- Diego Nehab's LTN12 - Filters, sources, sinks and pumps.
-- See http://lua-users.org/wiki/FiltersSourcesAndSinks for design concepts 
module("luci.ltn12")

filter = {}
source = {}
sink = {}
pump = {}

-- 2048 seems to be better in windows...
BLOCKSIZE = 2048
_VERSION = "LTN12 1.0.1"

-----------------------------------------------------------------------------
-- Filter stuff
-----------------------------------------------------------------------------

--- LTN12 Filter constructors
-- @class module
-- @name luci.ltn12.filter

--- Return a high level filter that cycles a low-level filter
-- by passing it each chunk and updating a context between calls. 
-- @param low   Low-level filter
-- @param ctx   Context
-- @param extra Extra argument passed to the low-level filter
-- @return LTN12 filter
function filter.cycle(low, ctx, extra)
    base.assert(low)
    return function(chunk)
        local ret
        ret, ctx = low(ctx, chunk, extra)
        return ret
    end
end

--- Chain a bunch of filters together.
-- (thanks to Wim Couwenberg)
-- @param ... filters to be chained
-- @return LTN12 filter
function filter.chain(...)
    local n = table.getn(arg)
    local top, index = 1, 1
    local retry = ""
    return function(chunk)
        retry = chunk and retry
        while true do
            if index == top then
                chunk = arg[index](chunk)
                if chunk == "" or top == n then return chunk
                elseif chunk then index = index + 1
                else
                    top = top+1
                    index = top
                end
            else
                chunk = arg[index](chunk or "")
                if chunk == "" then
                    index = index - 1
                    chunk = retry
                elseif chunk then
                    if index == n then return chunk
                    else index = index + 1 end
                else base.error("filter returned inappropriate nil") end
            end
        end
    end
end

-----------------------------------------------------------------------------
-- Source stuff
-----------------------------------------------------------------------------

--- LTN12 Source constructors
-- @class module
-- @name luci.ltn12.source

-- create an empty source
local function empty()
    return nil
end

--- Create an empty source.
-- @return LTN12 source
function source.empty()
    return empty
end

--- Return a source that just outputs an error.
-- @param err Error object
-- @return LTN12 source
function source.error(err)
    return function()
        return nil, err
    end
end

--- Create a file source.
-- @param handle File handle ready for reading
-- @param io_err IO error object
-- @return LTN12 source
function source.file(handle, io_err)
    if handle then
        return function()
            local chunk = handle:read(BLOCKSIZE)
            if not chunk then handle:close() end
            return chunk
        end
    else return source.error(io_err or "unable to open file") end
end

--- Turn a fancy source into a simple source.
-- @param src fancy source
-- @return LTN12 source
function source.simplify(src)
    base.assert(src)
    return function()
        local chunk, err_or_new = src()
        src = err_or_new or src
        if not chunk then return nil, err_or_new
        else return chunk end
    end
end

--- Create a string source.
-- @param s Data
-- @return LTN12 source
function source.string(s)
    if s then
        local i = 1
        return function()
            local chunk = string.sub(s, i, i+BLOCKSIZE-1)
            i = i + BLOCKSIZE
            if chunk ~= "" then return chunk
            else return nil end
        end
    else return source.empty() end
end

--- Creates rewindable source.
-- @param src LTN12 source to be made rewindable
-- @return LTN12 source
function source.rewind(src)
    base.assert(src)
    local t = {}
    return function(chunk)
        if not chunk then
            chunk = table.remove(t)
            if not chunk then return src()
            else return chunk end
        else
            t[#t+1] = chunk
        end
    end
end

--- Chain a source and a filter together.
-- @param src LTN12 source
-- @param f LTN12 filter
-- @return LTN12 source
function source.chain(src, f)
    base.assert(src and f)
    local last_in, last_out = "", ""
    local state = "feeding"
    local err
    return function()
        if not last_out then
            base.error('source is empty!', 2)
        end
        while true do
            if state == "feeding" then
                last_in, err = src()
                if err then return nil, err end
                last_out = f(last_in)
                if not last_out then
                    if last_in then
                        base.error('filter returned inappropriate nil')
                    else
                        return nil
                    end
                elseif last_out ~= "" then
                    state = "eating"
                    if last_in then last_in = "" end
                    return last_out
                end
            else
                last_out = f(last_in)
                if last_out == "" then
                    if last_in == "" then
                        state = "feeding"
                    else
                        base.error('filter returned ""')
                    end
                elseif not last_out then
                    if last_in then
                        base.error('filter returned inappropriate nil')
                    else
                        return nil
                    end
                else
                    return last_out
                end
            end
        end
    end
end

--- Create a source that produces contents of several sources.
-- Sources will be used one after the other, as if they were concatenated
-- (thanks to Wim Couwenberg)
-- @param ... LTN12 sources
-- @return LTN12 source
function source.cat(...)
    local src = table.remove(arg, 1)
    return function()
        while src do
            local chunk, err = src()
            if chunk then return chunk end
            if err then return nil, err end
            src = table.remove(arg, 1)
        end
    end
end

-----------------------------------------------------------------------------
-- Sink stuff
-----------------------------------------------------------------------------

--- LTN12 sink constructors
-- @class module
-- @name luci.ltn12.sink

--- Create a sink that stores into a table.
-- @param t output table to store into
-- @return LTN12 sink
function sink.table(t)
    t = t or {}
    local f = function(chunk, err)
        if chunk then t[#t+1] = chunk end
        return 1
    end
    return f, t
end

--- Turn a fancy sink into a simple sink.
-- @param snk fancy sink
-- @return LTN12 sink
function sink.simplify(snk)
    base.assert(snk)
    return function(chunk, err)
        local ret, err_or_new = snk(chunk, err)
        if not ret then return nil, err_or_new end
        snk = err_or_new or snk
        return 1
    end
end

--- Create a file sink.
-- @param handle file handle to write to
-- @param io_err IO error
-- @return LTN12 sink
function sink.file(handle, io_err)
    if handle then
        return function(chunk, err)
            if not chunk then
                handle:close()
                return 1
            else return handle:write(chunk) end
        end
    else return sink.error(io_err or "unable to open file") end
end

-- creates a sink that discards data
local function null()
    return 1
end

--- Create a sink that discards data.
-- @return LTN12 sink
function sink.null()
    return null
end

--- Create a sink that just returns an error.
-- @param err Error object
-- @return LTN12 sink
function sink.error(err)
    return function()
        return nil, err
    end
end

--- Chain a sink with a filter.
-- @param f LTN12 filter
-- @param snk LTN12 sink
-- @return LTN12 sink
function sink.chain(f, snk)
    base.assert(f and snk)
    return function(chunk, err)
        if chunk ~= "" then
            local filtered = f(chunk)
            local done = chunk and ""
            while true do
                local ret, snkerr = snk(filtered, err)
                if not ret then return nil, snkerr end
                if filtered == done then return 1 end
                filtered = f(done)
            end
        else return 1 end
    end
end

-----------------------------------------------------------------------------
-- Pump stuff
-----------------------------------------------------------------------------

--- LTN12 pump functions
-- @class module
-- @name luci.ltn12.pump

--- Pump one chunk from the source to the sink.
-- @param src LTN12 source
-- @param snk LTN12 sink
-- @return Chunk of data or nil if an error occured
-- @return Error object
function pump.step(src, snk)
    local chunk, src_err = src()
    local ret, snk_err = snk(chunk, src_err)
    if chunk and ret then return 1
    else return nil, src_err or snk_err end
end

--- Pump all data from a source to a sink, using a step function.
-- @param src LTN12 source
-- @param snk LTN12 sink
-- @param step step function (optional)
-- @return 1 if the operation succeeded otherwise nil
-- @return Error object
function pump.all(src, snk, step)
    base.assert(src and snk)
    step = step or pump.step
    while true do
        local ret, err = step(src, snk)
        if not ret then
            if err then return nil, err
            else return 1 end
        end
    end
end

