--[[

HTTP server implementation for LuCI - file handler
(c) 2008 Steven Barth <steven@midlink.org>
(c) 2008 Freifunk Leipzig / Jo-Philipp Wich <xm@leipzig.freifunk.net>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

$Id$

]]--

local ipairs, type, tonumber = ipairs, type, tonumber
local os = require "os"
local nixio = require "nixio", require "nixio.util"
local fs = require "nixio.fs"
local util = require "luci.util"
local ltn12 = require "luci.ltn12"
local srv = require "luci.lucid.http.server"
local string = require "string"

local prot = require "luci.http.protocol"
local date = require "luci.http.protocol.date"
local mime = require "luci.http.protocol.mime"
local cond = require "luci.http.protocol.conditionals"

--- File system handler
-- @cstyle instance
module "luci.lucid.http.handler.file"

--- Create a simple file system handler.
-- @class function
-- @param name Name
-- @param docroot Physical Document Root
-- @param options Options
-- @return Simple file system handler object
Simple = util.class(srv.Handler)

function Simple.__init__(self, name, docroot, options)
	srv.Handler.__init__(self, name)
	self.docroot = docroot
	self.realdocroot = fs.realpath(self.docroot)

	options = options or {}
	self.dirlist = not options.noindex
	self.error404 = options.error404
end

--- Parse a range request.
-- @param request Request object
-- @param size File size
-- @return offset, length, range header or boolean status
function Simple.parse_range(self, request, size)
	if not request.headers.Range then
		return true
	end

	local from, to = request.headers.Range:match("bytes=([0-9]*)-([0-9]*)")
	if not (from or to) then
		return true
	end

	from, to = tonumber(from), tonumber(to)
	if not (from or to) then
		return true
	elseif not from then
		from, to = size - to, size - 1
	elseif not to then
		to = size - 1
	end

	-- Not satisfiable
	if from >= size then
		return false
	end

	-- Normalize
	if to >= size then
		to = size - 1
	end

	local range = "bytes " .. from .. "-" .. to .. "/" .. size
	return from, (1 + to - from), range
end

--- Translate path and return file information.
-- @param uri Request URI
-- @return physical file path, file information
function Simple.getfile(self, uri)
	if not self.realdocroot then
		self.realdocroot = fs.realpath(self.docroot)
	end
	local file = fs.realpath(self.docroot .. uri)
	if not file or file:sub(1, #self.realdocroot) ~= self.realdocroot then
		return uri
	end
	return file, fs.stat(file)
end

--- Handle a GET request.
-- @param request Request object
-- @return status code, header table, response source
function Simple.handle_GET(self, request)
	local file, stat = self:getfile(prot.urldecode(request.env.PATH_INFO, true))

	if stat then
		if stat.type == "reg" then

			-- Generate Entity Tag
			local etag = cond.mk_etag( stat )

			-- Check conditionals
			local ok, code, hdrs

			ok, code, hdrs = cond.if_modified_since( request, stat )
			if ok then
				ok, code, hdrs = cond.if_match( request, stat )
				if ok then
					ok, code, hdrs = cond.if_unmodified_since( request, stat )
					if ok then
						ok, code, hdrs = cond.if_none_match( request, stat )
						if ok then
							local f, err = nixio.open(file)

							if f then
								local code = 200
								local o, s, r = self:parse_range(request, stat.size)

								if not o then
									return self:failure(416, "Invalid Range")
								end

								local headers = {
									["Cache-Control"]  = "max-age=29030400",
									["Last-Modified"]  = date.to_http( stat.mtime ),
									["Content-Type"]   = mime.to_mime( file ),
									["ETag"]           = etag,
									["Accept-Ranges"]  = "bytes",
								}

								if o == true then
									s = stat.size
								else
									code = 206
									headers["Content-Range"] = r
									f:seek(o)
								end
								
								headers["Content-Length"] = s

								-- Send Response
								return code, headers, srv.IOResource(f, s)
							else
								return self:failure( 403, err:gsub("^.+: ", "") )
							end
						else
							return code, hdrs
						end
					else
						return code, hdrs
					end
				else
					return code, hdrs
				end
			else
				return code, hdrs
			end

		elseif stat.type == "dir" then

			local ruri = request.env.REQUEST_URI:gsub("/$", "")
			local duri = prot.urldecode( ruri, true )
			local root = self.docroot

			-- check for index files
			local index_candidates = {
				"index.html", "index.htm", "default.html", "default.htm",
				"index.txt", "default.txt"
			}

			-- try to find an index file and redirect to it
			for i, candidate in ipairs( index_candidates ) do
				local istat = fs.stat(
					root .. "/" .. duri .. "/" .. candidate
				)

				if istat ~= nil and istat.type == "reg" then
					return 302, { Location = ruri .. "/" .. candidate }
				end
			end


			local html = string.format(
				'<?xml version="1.0" encoding="utf-8"?>\n' ..
				'<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" '	..
					'"http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">\n'..
				'<html xmlns="http://www.w3.org/1999/xhtml" '				..
					'xml:lang="en" lang="en">\n'							..
				'<head>\n'													..
				'<title>Index of %s/</title>\n'								..
				'<style type="text/css">\n'									..
					'body { color:#000000 } '								..
					'li { border-bottom:1px dotted #CCCCCC; padding:3px } '	..
					'small { font-size:60%%; color:#333333 } '				..
					'p { margin:0 }'										..
					'\n</style></head><body><h1>Index of %s/</h1><hr /><ul>'..
					'<li><p><a href="%s/../">../</a> '						..
					'<small>(parent directory)</small><br />'				..
					'<small></small></li>',
					duri, duri, ruri 
			)

			local entries = fs.dir( file )

			if type(entries) == "function" then
				for i, e in util.vspairs(nixio.util.consume(entries)) do
					local estat = fs.stat( file .. "/" .. e )

					if estat.type == "dir" then
						html = html .. string.format(
							'<li><p><a href="%s/%s/">%s/</a> '           ..
							'<small>(directory)</small><br />'           ..
							'<small>Changed: %s</small></li>',
								ruri, prot.urlencode( e ), e,
								date.to_http( estat.mtime )
						)
					else
						html = html .. string.format(
							'<li><p><a href="%s/%s">%s</a> '             ..
							'<small>(%s)</small><br />'                  ..
							'<small>Size: %i Bytes | '                   ..
								'Changed: %s</small></li>',
								ruri, prot.urlencode( e ), e,
								mime.to_mime( e ),
								estat.size, date.to_http( estat.mtime )
						)
					end
				end

				html = html .. '</ul><hr /><address>LuCId-HTTPd' .. 
					'</address></body></html>'

				return 200, {
						["Date"]         = date.to_http( os.time() );
						["Content-Type"] = "text/html; charset=utf-8";
					}, ltn12.source.string(html)
			else
				return self:failure(403, "Permission denied")
			end
		else
			return self:failure(403, "Unable to transmit " .. stat.type .. " " .. file)
		end
	else
		if self.error404 then
			return 302, { Location = self.error404 }
		else
			return self:failure(404, "No such file: " .. file)
		end
	end
end

--- Handle a HEAD request.
-- @param request Request object
-- @return status code, header table, response source
function Simple.handle_HEAD(self, ...)
	local stat, head = self:handle_GET(...)
	return stat, head
end
