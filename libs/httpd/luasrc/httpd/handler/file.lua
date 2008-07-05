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

module("luci.httpd.handler.file", package.seeall)

require("luci.httpd.module")
require("luci.http.protocol.date")
require("luci.http.protocol.mime")
require("luci.http.protocol.conditionals")
require("luci.fs")
local ltn12 = require("luci.ltn12")

Simple = luci.util.class(luci.httpd.module.Handler)
Response = luci.httpd.module.Response

function Simple.__init__(self, docroot, dirlist)
	luci.httpd.module.Handler.__init__(self)
	self.docroot = docroot
	self.dirlist = dirlist and true or false
	self.proto   = luci.http.protocol
	self.mime    = luci.http.protocol.mime
	self.date    = luci.http.protocol.date
	self.cond    = luci.http.protocol.conditionals
end

function Simple.getfile(self, uri)
	local file = self.docroot .. uri:gsub("%.%./+", "")
	local stat = luci.fs.stat(file)

	return file, stat
end

function Simple.handle_get(self, request, sourcein, sinkerr)
	local file, stat = self:getfile( self.proto.urldecode( request.env.PATH_INFO, true ) )

	if stat then
		if stat.type == "regular" then

			-- Generate Entity Tag
			local etag = self.cond.mk_etag( stat )

			-- Check conditionals
			local ok, code, hdrs

			ok, code, hdrs = self.cond.if_modified_since( request, stat )
			if ok then
				ok, code, hdrs = self.cond.if_match( request, stat )
				if ok then
					ok, code, hdrs = self.cond.if_unmodified_since( request, stat )
					if ok then
						ok, code, hdrs = self.cond.if_none_match( request, stat )
						if ok then
							local f, err = io.open(file)

							if f then
								-- Send Response
								return Response(
									200, {
										["Date"]           = self.date.to_http( os.time() );
										["Last-Modified"]  = self.date.to_http( stat.mtime );
										["Content-Type"]   = self.mime.to_mime( file );
										["Content-Length"] = stat.size;
										["ETag"]           = etag;
									}
								), ltn12.source.file(f)
							else
								return self:failure( 403, err:gsub("^.+: ", "") )
							end
						else
							return Response( code, hdrs or { } )
						end
					else
						return Response( code, hdrs or { } )
					end
				else
					return Response( code, hdrs or { } )
				end
			else
				return Response( code, hdrs or { } )
			end

		elseif stat.type == "directory" then

			local ruri = request.request_uri:gsub("/$","")
			local duri = self.proto.urldecode( ruri, true )
			local root = self.docroot:gsub("/$","")

			-- check for index files
			local index_candidates = {
				"index.html", "index.htm", "default.html", "default.htm",
				"index.txt", "default.txt"
			}

			-- try to find an index file and redirect to it
			for i, candidate in ipairs( index_candidates ) do
				local istat = luci.fs.stat(
					root .. "/" .. duri .. "/" .. candidate
				)

				if istat ~= nil and istat.type == "regular" then
					return Response( 301, {
						["Location"] = ruri .. "/" .. candidate
					} ), ltn12.source.empty()
				end
			end


			local html = string.format(
				'<?xml version="1.0" encoding="ISO-8859-15"?>\n' ..
				'<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" '  ..
					'"http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">\n' ..
				'<html xmlns="http://www.w3.org/1999/xhtml" '                ..
					'xml:lang="en" lang="en">\n'                             ..
				'<head>\n'                                                   ..
				'<title>Index of %s/</title>\n'                              ..
				'<style type="text/css"><!--\n'                              ..
					'body { background-color:#FFFFFF; color:#000000 } '      ..
					'li { border-bottom:1px dotted #CCCCCC; padding:3px } '  ..
					'small { font-size:60%%; color:#999999 } '               ..
					'p { margin:0 }'                                         ..
				'\n--></style></head><body><h1>Index of %s/</h1><hr /><ul>',
					duri, duri
			)

			local entries = luci.fs.dir( file )

			if type(entries) == "table" then
				for i, e in luci.util.spairs(
					entries, function(a,b)
						if entries[a] == '..' then
							return true
						elseif entries[b] == '..' then
							return false
						else
							return ( entries[a] < entries[b] )
						end
					end
				) do
					if e ~= '.' and ( e == '..' or e:sub(1,1) ~= '.' ) then
						local estat = luci.fs.stat( file .. "/" .. e )

						if estat.type == "directory" then
							html = html .. string.format(
								'<li><p><a href="%s/%s/">%s/</a> '           ..
								'<small>(directory)</small><br />'           ..
								'<small>Changed: %s</small></li>',
									ruri, self.proto.urlencode( e ), e,
									self.date.to_http( estat.mtime )
							)
						else
							html = html .. string.format(
								'<li><p><a href="%s/%s">%s</a> '             ..
								'<small>(%s)</small><br />'                  ..
								'<small>Size: %i Bytes | '                   ..
									'Changed: %s</small></li>',
									ruri, self.proto.urlencode( e ), e,
									self.mime.to_mime( e ),
									estat.size, self.date.to_http( estat.mtime )
							)
						end
					end
				end

				html = html .. '</ul><hr /></body></html>'

				return Response(
					200, {
						["Date"]         = self.date.to_http( os.time() );
						["Content-Type"] = "text/html; charset=ISO-8859-15";
					}
				), ltn12.source.string(html)
			else
				return self:failure(403, "Permission denied")
			end
		else
			return self:failure(403, "Unable to transmit " .. stat.type .. " " .. file)
		end
	else
		return self:failure(404, "No such file: " .. file)
	end
end

function Simple.handle_head(self, ...)
	local response, sourceout = self:handle_get(...)
	return response
end
