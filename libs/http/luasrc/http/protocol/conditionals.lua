--[[

HTTP protocol implementation for LuCI - RFC2616 / 14.19, 14.24 - 14.28
(c) 2008 Freifunk Leipzig / Jo-Philipp Wich <xm@leipzig.freifunk.net>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

$Id$

]]--

module("luci.http.protocol.conditionals", package.seeall)

local date = require("luci.http.protocol.date")


-- 14.19 / ETag
function mk_etag( stat )
	if stat ~= nil then
		return string.format( '"%x-%x-%x"', stat.ino, stat.size, stat.mtime )
	end
end

-- 14.24 / If-Match
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

-- 14.25 / If-Modified-Since
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
			["Last-Modified"] = date.to_http( stat.mtime )
		}
	end

	return true
end

-- 14.26 / If-None-Match
function if_none_match( req, stat )
	local h    = req.headers
	local etag = mk_etag( stat )

	-- Check for matching resource
	if type(h['If-None-Match']) == "string" then
		for ent in h['If-None-Match']:gmatch("([^, ]+)") do
			if ( ent == '*' or ent == etag ) and stat ~= nil then
				if req.request_method == "get"  or
				   req.request_method == "head"
				then
					return false, 304, {
						["ETag"]          = mk_etag( stat );
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

-- 14.27 / If-Range
function if_range( req, stat )
	-- Sorry, no subranges (yet)
	return false, 412
end

-- 14.28 / If-Unmodified-Since
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
