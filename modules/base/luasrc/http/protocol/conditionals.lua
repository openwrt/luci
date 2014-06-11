--[[

HTTP protocol implementation for LuCI - RFC2616 / 14.19, 14.24 - 14.28
(c) 2008 Freifunk Leipzig / Jo-Philipp Wich <xm@leipzig.freifunk.net>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

$Id$

]]--

--- LuCI http protocol implementation - HTTP/1.1 bits.
-- This class provides basic ETag handling and implements most of the
-- conditional HTTP/1.1 headers specified in RFC2616 Sct. 14.24 - 14.28 .
module("luci.http.protocol.conditionals", package.seeall)

local date = require("luci.http.protocol.date")


--- Implement 14.19 / ETag.
-- @param stat	A file.stat structure
-- @return		String containing the generated tag suitable for ETag headers
function mk_etag( stat )
	if stat ~= nil then
		return string.format( '"%x-%x-%x"', stat.ino, stat.size, stat.mtime )
	end
end

--- 14.24 / If-Match
-- Test whether the given message object contains an "If-Match" header and
-- compare it against the given stat object.
-- @param req	HTTP request message object
-- @param stat	A file.stat object
-- @return		Boolean indicating whether the precondition is ok
-- @return		Alternative status code if the precondition failed
function if_match( req, stat )
	local h    = req.headers
	local etag = mk_etag( stat )

	-- Check for matching resource
	if type(h['If-Match']) == "string" then
		for ent in h['If-Match']:gmatch("([^, ]+)") do
			if ( ent == '*' or ent == etag ) and stat ~= nil then
				return true
			end
		end

		return false, 412
	end

	return true
end

--- 14.25 / If-Modified-Since
-- Test whether the given message object contains an "If-Modified-Since" header
-- and compare it against the given stat object.
-- @param req	HTTP request message object
-- @param stat	A file.stat object
-- @return		Boolean indicating whether the precondition is ok
-- @return		Alternative status code if the precondition failed
-- @return		Table containing extra HTTP headers if the precondition failed
function if_modified_since( req, stat )
	local h = req.headers

	-- Compare mtimes
	if type(h['If-Modified-Since']) == "string" then
		local since = date.to_unix( h['If-Modified-Since'] )

		if stat == nil or since < stat.mtime then
			return true
		end

		return false, 304, {
			["ETag"]          = mk_etag( stat );
			["Date"]          = date.to_http( os.time() );
			["Last-Modified"] = date.to_http( stat.mtime )
		}
	end

	return true
end

--- 14.26 / If-None-Match
-- Test whether the given message object contains an "If-None-Match" header and
-- compare it against the given stat object.
-- @param req	HTTP request message object
-- @param stat	A file.stat object
-- @return		Boolean indicating whether the precondition is ok
-- @return		Alternative status code if the precondition failed
-- @return		Table containing extra HTTP headers if the precondition failed
function if_none_match( req, stat )
	local h      = req.headers
	local etag   = mk_etag( stat )
	local method = req.env and req.env.REQUEST_METHOD or "GET"

	-- Check for matching resource
	if type(h['If-None-Match']) == "string" then
		for ent in h['If-None-Match']:gmatch("([^, ]+)") do
			if ( ent == '*' or ent == etag ) and stat ~= nil then
				if method == "GET" or method == "HEAD" then
					return false, 304, {
						["ETag"]          = etag;
						["Date"]          = date.to_http( os.time() );
						["Last-Modified"] = date.to_http( stat.mtime )
					}
				else
					return false, 412
				end
			end
		end
	end

	return true
end

--- 14.27 / If-Range
-- The If-Range header is currently not implemented due to the lack of general
-- byte range stuff in luci.http.protocol . This function will always return
-- false, 412 to indicate a failed precondition.
-- @param req	HTTP request message object
-- @param stat	A file.stat object
-- @return		Boolean indicating whether the precondition is ok
-- @return		Alternative status code if the precondition failed
function if_range( req, stat )
	-- Sorry, no subranges (yet)
	return false, 412
end

--- 14.28 / If-Unmodified-Since
-- Test whether the given message object contains an "If-Unmodified-Since"
-- header and compare it against the given stat object.
-- @param req	HTTP request message object
-- @param stat	A file.stat object
-- @return		Boolean indicating whether the precondition is ok
-- @return		Alternative status code if the precondition failed
function if_unmodified_since( req, stat )
	local h = req.headers

	-- Compare mtimes
	if type(h['If-Unmodified-Since']) == "string" then
		local since = date.to_unix( h['If-Unmodified-Since'] )

		if stat ~= nil and since <= stat.mtime then
			return false, 412
		end
	end

	return true
end
