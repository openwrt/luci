--[[

HTTP protocol implementation for LuCI
(c) 2008 Freifunk Leipzig / Jo-Philipp Wich <xm@leipzig.freifunk.net>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

$Id$

]]--

module("luci.http.protocol", package.seeall)

require("ltn12")
require("luci.http.protocol.filter")

HTTP_MAX_CONTENT      = 1024*4		-- 4 kB maximum content size
HTTP_URLENC_MAXKEYLEN = 1024		-- maximum allowd size of urlencoded parameter names


-- Decode an urlencoded string.
-- Returns the decoded value.
function urldecode( str )

	local function __chrdec( hex )
		return string.char( tonumber( hex, 16 ) )
	end

	if type(str) == "string" then
		str = str:gsub( "+", " " ):gsub( "%%([a-fA-F0-9][a-fA-F0-9])", __chrdec )
	end

	return str
end


-- Extract and split urlencoded data pairs, separated bei either "&" or ";" from given url.
-- Returns a table value with urldecoded values.
function urldecode_params( url, tbl )

	local params = tbl or { }

	if url:find("?") then
		url = url:gsub( "^.+%?([^?]+)", "%1" )
	end

	for pair in url:gmatch( "[^&;]+" ) do

		-- find key and value
		local key = urldecode( pair:match("^([^=]+)")     )
		local val = urldecode( pair:match("^[^=]+=(.+)$") )

		-- store
		if type(key) == "string" and key:len() > 0 then
			if type(val) ~= "string" then val = "" end

			if not params[key] then
				params[key] = val
			elseif type(params[key]) ~= "table" then
				params[key] = { params[key], val }
			else
				table.insert( params[key], val )
			end
		end
	end

	return params
end


-- Encode given string in urlencoded format.
-- Returns the encoded string.
function urlencode( str )

	local function __chrenc( chr )
		return string.format(
			"%%%02x", string.byte( chr )
		)
	end

	if type(str) == "string" then
		str = str:gsub(
			"([^a-zA-Z0-9$_%-%.+!*'(),])",
			__chrenc
		)
	end

	return str
end


-- Encode given table to urlencoded string.
-- Returns the encoded string.
function urlencode_params( tbl )
	local enc = ""

	for k, v in pairs(tbl) do
		enc = enc .. ( enc and "&" or "" ) ..
			urlencode(k) .. "="  ..
			urlencode(v)
	end

	return enc
end


-- Table of our process states
local process_states = { }

-- Extract "magic", the first line of a http message.
-- Extracts the message type ("get", "post" or "response"), the requested uri
-- or the status code if the line descripes a http response.
process_states['magic'] = function( msg, chunk )

	if chunk ~= nil then

		-- Is it a request?
		local method, uri, http_ver = chunk:match("^([A-Z]+) ([^ ]+) HTTP/([01]%.[019])$")

		-- Yup, it is
		if method then

			msg.type           = "request"
			msg.request_method = method:lower()
			msg.request_uri    = uri
			msg.http_version   = tonumber( http_ver )
			msg.headers        = { }

			-- We're done, next state is header parsing
			return true, function( chunk )
				return process_states['headers']( msg, chunk )
			end

		-- Is it a response?
		else

			local http_ver, code, message = chunk:match("^HTTP/([01]%.[019]) ([0-9]+) ([^\r\n]+)$")

			-- Is a response
			if code then

				msg.type           = "response"
				msg.status_code    = code
				msg.status_message = message
				msg.http_version   = tonumber( http_ver )
				msg.headers        = { }

				-- We're done, next state is header parsing
				return true, function( chunk )
					return process_states['headers']( msg, chunk )
				end
			end
		end
	end

	-- Can't handle it
	return nil, "Invalid HTTP message magic"
end


-- Extract headers from given string.
process_states['headers'] = function( msg, chunk )

	if chunk ~= nil then

		-- Look for a valid header format
		local hdr, val = chunk:match( "^([A-Z][A-Za-z0-9%-_]+): +(.+)$" )

		if type(hdr) == "string" and hdr:len() > 0 and
		   type(val) == "string" and val:len() > 0
		then
			msg.headers[hdr] = val

			-- Valid header line, proceed
			return true, nil

		elseif #chunk == 0 then
			-- Empty line, we won't accept data anymore
			return false, nil
		else
			-- Junk data
			return nil, "Invalid HTTP header received"
		end
	else
		return nil, "Unexpected EOF"
	end
end


-- Find first MIME boundary
process_states['mime-init'] = function( msg, chunk, filecb )

	if chunk ~= nil then
		if #chunk >= #msg.mime_boundary + 2 then
			local boundary = chunk:sub( 1, #msg.mime_boundary + 4 )

			if boundary == "--" .. msg.mime_boundary .. "\r\n" then

				-- Store remaining data in buffer
				msg._mimebuffer = chunk:sub( #msg.mime_boundary + 5, #chunk )

				-- Switch to header processing state
				return true, function( chunk )
					return process_states['mime-headers']( msg, chunk, filecb )
				end
			else
				return nil, "Invalid MIME boundary"
			end
		else
			return true
		end
	else
		return nil, "Unexpected EOF"
	end
end


-- Read MIME part headers
process_states['mime-headers'] = function( msg, chunk, filecb )

	if chunk ~= nil then

		-- Combine look-behind buffer with current chunk
		chunk = msg._mimebuffer .. chunk

		if not msg._mimeheaders then
			msg._mimeheaders = { }
		end

		local function __storehdr( k, v )
			msg._mimeheaders[k] = v
			return ""
		end

		-- Read all header lines
		local ok, count = 1, 0
		while ok > 0 do
			chunk, ok = chunk:gsub( "^([A-Z][A-Za-z0-9%-_]+): +([^\r\n]+)\r\n", __storehdr )
			count = count + ok
		end

		-- Headers processed, check for empty line
		chunk, ok = chunk:gsub( "^\r\n", "" )

		-- Store remaining buffer contents
		msg._mimebuffer = chunk

		-- End of headers
		if ok > 0 then

			-- When no Content-Type header is given assume text/plain
			if not msg._mimeheaders['Content-Type'] then
				msg._mimeheaders['Content-Type'] = 'text/plain'
			end

			-- Check Content-Disposition
			if msg._mimeheaders['Content-Disposition'] then
				-- Check for "form-data" token
				if msg._mimeheaders['Content-Disposition']:match("^form%-data; ") then
					-- Check for field name, filename
					local field = msg._mimeheaders['Content-Disposition']:match('name="(.-)"')
					local file  = msg._mimeheaders['Content-Disposition']:match('filename="(.+)"$')

					-- Is a file field and we have a callback
					if file and filecb then
						msg.params[field] = file
						msg._mimecallback = function(chunk,eof)
							filecb( {
								name    = field;
								file    = file;
								headers = msg._mimeheaders
							}, chunk, eof )
						end

					-- Treat as form field
					else
						msg.params[field] = ""
						msg._mimecallback = function(chunk,eof)
							msg.params[field] = msg.params[field] .. chunk
						end
					end

					-- Header was valid, continue with mime-data
					return true, function( chunk )
						return process_states['mime-data']( msg, chunk, filecb )
					end
				else
					-- Unknown Content-Disposition, abort
					return nil, "Unexpected Content-Disposition MIME section header"
				end
			else
				-- Content-Disposition is required, abort without
				return nil, "Missing Content-Disposition MIME section header"
			end

		-- We parsed no headers yet and buffer is almost empty
		elseif count > 0 or #chunk < 128 then
			-- Keep feeding me with chunks
			return true, nil
		end

		-- Buffer looks like garbage
		return nil, "Malformed MIME section header"
	else
		return nil, "Unexpected EOF"
	end
end


-- Read MIME part data
process_states['mime-data'] = function( msg, chunk, filecb )

	if chunk ~= nil then

		-- Combine look-behind buffer with current chunk
		local buffer = msg._mimebuffer .. chunk

		-- Look for MIME boundary
		local spos, epos = buffer:find( "\r\n--" .. msg.mime_boundary .. "\r\n", 1, true )

		if spos then
			-- Content data
			msg._mimecallback( buffer:sub( 1, spos - 1 ), true )

			-- Store remainder
			msg._mimebuffer = buffer:sub( epos + 1, #buffer )

			-- Next state is mime-header processing
			return true, function( chunk )
				return process_states['mime-headers']( msg, chunk, filecb )
			end
		else
			-- Look for EOF?
			local spos, epos = buffer:find( "\r\n--" .. msg.mime_boundary .. "--\r\n", 1, true )

			if spos then
				-- Content data
				msg._mimecallback( buffer:sub( 1, spos - 1 ), true )

				-- We processed the final MIME boundary, cleanup
				msg._mimebuffer   = nil
				msg._mimeheaders  = nil
				msg._mimecallback = nil

				-- We won't accept data anymore
				return false
			else
				-- We're somewhere within a data section and our buffer is full
				if #buffer > #chunk then
					-- Flush buffered data
					msg._mimecallback( buffer:sub( 1, #buffer - #chunk ), false )

					-- Store new data
					msg._mimebuffer = buffer:sub( #buffer - #chunk + 1, #buffer )

				-- Buffer is not full yet, append new data
				else
					msg._mimebuffer = buffer
				end

				-- Keep feeding me
				return true
			end
		end
	else
		return nil, "Unexpected EOF"
	end
end


-- Init urldecoding stream
process_states['urldecode-init'] = function( msg, chunk, filecb )

	if chunk ~= nil then

		-- Check for Content-Length
		if msg.env.CONTENT_LENGTH then
			msg.content_length = tonumber(msg.env.CONTENT_LENGTH)

			if msg.content_length <= HTTP_MAX_CONTENT then
				-- Initialize buffer
				msg._urldecbuffer = chunk
				msg._urldeclength = 0

				-- Switch to urldecode-key state
				return true, function(chunk)
					return process_states['urldecode-key']( msg, chunk, filecb )
				end
			else
				return nil, "Request exceeds maximum allowed size"
			end
		else
			return nil, "Missing Content-Length header"
		end
	else
		return nil, "Unexpected EOF"
	end
end


-- Process urldecoding stream, read and validate parameter key
process_states['urldecode-key'] = function( msg, chunk, filecb )
	if chunk ~= nil then

		-- Prevent oversized requests
		if msg._urldeclength >= msg.content_length then
			return nil, "Request exceeds maximum allowed size"
		end

		-- Combine look-behind buffer with current chunk
		local buffer = msg._urldecbuffer .. chunk
		local spos, epos = buffer:find("=")

		-- Found param
		if spos then

			-- Check that key doesn't exceed maximum allowed key length
			if ( spos - 1 ) <= HTTP_URLENC_MAXKEYLEN then
				local key = urldecode( buffer:sub( 1, spos - 1 ) )

				-- Prepare buffers
				msg.params[key]		= ""
				msg._urldeclength   = msg._urldeclength + epos
				msg._urldecbuffer   = buffer:sub( epos + 1, #buffer )

				-- Use file callback or store values inside msg.params
				if filecb then
					msg._urldeccallback = function( chunk, eof )
						filecb( field, chunk, eof )
					end
				else
					msg._urldeccallback = function( chunk, eof )
						msg.params[key] = msg.params[key] .. chunk

						-- FIXME: Use a filter
						if eof then
							msg.params[key] = urldecode( msg.params[key] )
						end
					end
				end

				-- Proceed with urldecode-value state
				return true, function( chunk )
					return process_states['urldecode-value']( msg, chunk, filecb )
				end
			else
				return nil, "POST parameter exceeds maximum allowed length"
			end
		else
			return nil, "POST data exceeds maximum allowed length"
		end
	else
		return nil, "Unexpected EOF"
	end
end


-- Process urldecoding stream, read parameter value
process_states['urldecode-value'] = function( msg, chunk, filecb )

	if chunk ~= nil then

		-- Combine look-behind buffer with current chunk
		local buffer = msg._urldecbuffer .. chunk

		-- Check for EOF
		if #buffer == 0 then
			-- Compare processed length
			if msg._urldeclength == msg.content_length then
				-- Cleanup
				msg._urldeclength   = nil
				msg._urldecbuffer   = nil
				msg._urldeccallback = nil

				-- We won't accept data anymore
				return false
			else
				return nil, "Content-Length mismatch"
			end
		end

		-- Check for end of value
		local spos, epos = buffer:find("[&;]")
		if spos then

			-- Flush buffer, send eof
			msg._urldeccallback( buffer:sub( 1, spos - 1 ), true )
			msg._urldecbuffer = buffer:sub( epos + 1, #buffer )
			msg._urldeclength = msg._urldeclength + epos

			-- Back to urldecode-key state
			return true, function( chunk )
				return process_states['urldecode-key']( msg, chunk, filecb )
			end
		else
			-- We're somewhere within a data section and our buffer is full
			if #buffer > #chunk then
				-- Flush buffered data
				-- Send EOF if chunk is empty
				msg._urldeccallback( buffer:sub( 1, #buffer - #chunk ), ( #chunk == 0 ) )

				-- Store new data
				msg._urldeclength = msg._urldeclength + #buffer - #chunk
				msg._urldecbuffer = buffer:sub( #buffer - #chunk + 1, #buffer )

			-- Buffer is not full yet, append new data
			else
				msg._urldecbuffer = buffer
			end

			-- Keep feeding me
			return true
		end
	else
		return nil, "Unexpected EOF"
	end
end


-- Decode MIME encoded data.
function mimedecode_message_body( source, msg, filecb )

	-- Find mime boundary
	if msg and msg.env.CONTENT_TYPE then

		local bound = msg.env.CONTENT_TYPE:match("^multipart/form%-data; boundary=(.+)")

		if bound then
			msg.mime_boundary = bound
		else
			return nil, "No MIME boundary found or invalid content type given"
		end
	end

	-- Create an initial LTN12 sink
	-- The whole MIME parsing process is implemented as fancy sink, sinks replace themself
	-- depending on current processing state (init, header, data). Return the initial state.
	local sink = ltn12.sink.simplify(
		function( chunk )
			return process_states['mime-init']( msg, chunk, filecb )
		end
	)

	-- Create a throttling LTN12 source
	-- Frequent state switching in the mime parsing process leads to unwanted buffer aggregation.
	-- This source checks wheather there's still data in our internal read buffer and returns an
	-- empty string if there's already enough data in the processing queue. If the internal buffer
	-- runs empty we're calling the original source to get the next chunk of data.
	local tsrc = function()

		-- XXX: we schould propably keep the maximum buffer size in sync with
		--      the blocksize of our original source... but doesn't really matter
		if msg._mimebuffer ~= null and #msg._mimebuffer > 256 then
			return ""
		else
			return source()
		end
	end

	-- Pump input data...
	while true do
		-- get data
		local ok, err = ltn12.pump.step( tsrc, sink )

		-- error
		if not ok and err then
			return nil, err

		-- eof
		elseif not ok then
			return true
		end
	end
end


-- Decode urlencoded data.
function urldecode_message_body( source, msg )

	-- Create an initial LTN12 sink
	-- Return the initial state.
	local sink = ltn12.sink.simplify(
		function( chunk )
			return process_states['urldecode-init']( msg, chunk )
		end
	)

	-- Create a throttling LTN12 source
	-- See explaination in mimedecode_message_body().
	local tsrc = function()
		if msg._urldecbuffer ~= null and #msg._urldecbuffer > 0 then
			return ""
		else
			return source()
		end
	end

	-- Pump input data...
	while true do
		-- get data
		local ok, err = ltn12.pump.step( tsrc, sink )

		-- step
		if not ok and err then
			return nil, err

		-- eof
		elseif not ok then
			return true
		end
	end
end


-- Parse a http message
function parse_message( data, filecb )

	local reader  = _linereader( data, HTTP_MAX_READBUF )
	local message = parse_message_header( reader )

	if message then
		parse_message_body( reader, message, filecb )
	end

	return message
end


-- Parse a http message header
function parse_message_header( source )

	local ok   = true
	local msg  = { }

	local sink = ltn12.sink.simplify(
		function( chunk )
			return process_states['magic']( msg, chunk )
		end
	)

	-- Pump input data...
	while ok do

		-- get data
		ok, err = ltn12.pump.step( source, sink )

		-- error
		if not ok and err then
			return nil, err

		-- eof
		elseif not ok then

			-- Process get parameters
			if ( msg.request_method == "get" or msg.request_method == "post" ) and
			   msg.request_uri:match("?")
			then
				msg.params = urldecode_params( msg.request_uri )
			else
				msg.params = { }
			end

			-- Populate common environment variables
			msg.env = {
				CONTENT_LENGTH    = msg.headers['Content-Length'];
				CONTENT_TYPE      = msg.headers['Content-Type'];
				REQUEST_METHOD    = msg.request_method:upper();
				REQUEST_URI       = msg.request_uri;
				SCRIPT_NAME       = msg.request_uri:gsub("?.+$","");
				SCRIPT_FILENAME   = "";		-- XXX implement me
				SERVER_PROTOCOL   = "HTTP/" .. msg.http_version
			}

			-- Populate HTTP_* environment variables
			for i, hdr in ipairs( {
				'Accept',
				'Accept-Charset',
				'Accept-Encoding',
				'Accept-Language',
				'Connection',
				'Cookie',
				'Host',
				'Referer',
				'User-Agent',
			} ) do
				local var = 'HTTP_' .. hdr:upper():gsub("%-","_")
				local val = msg.headers[hdr]

				msg.env[var] = val
			end
		end
	end

	return msg
end


-- Parse a http message body
function parse_message_body( source, msg, filecb )

	-- Install an additional filter if we're operating on chunked transfer
	-- coding and client is HTTP/1.1 capable
	if msg.http_version == 1.1 and
	   msg.headers['Transfer-Encoding'] and
	   msg.headers['Transfer-Encoding']:find("chunked")
	then
		source = ltn12.source.chain(
			source, luci.http.protocol.filter.decode_chunked
		)
	end


	-- Is it multipart/mime ?
	if msg.env.REQUEST_METHOD == "POST" and msg.env.CONTENT_TYPE and
	   msg.env.CONTENT_TYPE:match("^multipart/form%-data")
	then

		return mimedecode_message_body( source, msg, filecb )

	-- Is it application/x-www-form-urlencoded ?
	elseif msg.env.REQUEST_METHOD == "POST" and msg.env.CONTENT_TYPE and
	       msg.env.CONTENT_TYPE == "application/x-www-form-urlencoded"
	then
		return urldecode_message_body( source, msg, filecb )


	-- Unhandled encoding
	-- If a file callback is given then feed it line by line, else
	-- store whole buffer in message.content
	else

		local sink

		-- If we have a file callback then feed it
		if type(filecb) == "function" then
			sink = filecb

		-- ... else append to .content
		else
			msg.content = ""
			msg.content_length = 0

			sink = function( chunk )
				if ( msg.content_length + #chunk ) <= HTTP_MAX_CONTENT then

					msg.content        = msg.content        .. chunk
					msg.content_length = msg.content_length + #chunk

					return true
				else
					return nil, "POST data exceeds maximum allowed length"
				end
			end
		end

		-- Pump data...
		while true do
			local ok, err = ltn12.pump.step( source, sink )

			if not ok and err then
				return nil, err
			elseif not err then
				return true
			end
		end
	end
end


-- Push a response to a socket
function push_response(request, response, sourceout, sinkout, sinkerr)
	local code = response.status
	sinkout(request.env.SERVER_PROTOCOL .. " " .. code .. " " .. statusmsg[code] .. "\r\n")

	-- FIXME: Add support for keep-alive
	response.headers["Connection"] = "close"

	for k,v in pairs(response.headers) do
		sinkout(k .. ": " .. v .. "\r\n")
	end

	sinkout("\r\n")

	if sourceout then
		ltn12.pump.all(sourceout, sinkout)
	end
end


-- Status codes
statusmsg = {
	[200] = "OK",
	[400] = "Bad Request",
	[403] = "Forbidden",
	[404] = "Not Found",
	[500] = "Internal Server Error",
	[503] = "Server Unavailable",
}