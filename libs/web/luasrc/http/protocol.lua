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

require("luci.util")


HTTP_MAX_CONTENT     = 1048576		-- 1 MB
HTTP_DEFAULT_CTYPE   = "text/html"	-- default content type
HTTP_DEFAULT_VERSION = "1.0"		-- HTTP default version


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
function urldecode_params( url )

	local params = { }

	if url:find("?") then
		url = url:gsub( "^.+%?([^?]+)", "%1" )
	end

	for i, pair in ipairs(luci.util.split( url, "[&;]+", nil, true )) do

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


-- Decode MIME encoded data.
-- Returns a table with decoded values.
function mimedecode( data, boundary, filecb )

	local params = { }

	-- create a line reader
	local reader = _linereader( data )

	-- state variables
	local in_part = false
	local in_file = false
	local in_fbeg = false
	local in_size = true

	local filename
	local buffer
	local field
	local clen = 0


	-- try to read all mime parts
	for line in reader do

		-- update content length
		clen = clen + line:len()

		if clen >= HTTP_MAX_CONTENT then
			in_size = false
		end

		-- when no boundary is given, try to find it
		if not boundary then
			boundary = line:match("^%-%-([^\r\n]+)\r?\n$")
		end

		-- Got a valid boundary line or reached max allowed size.
		if ( boundary and line:sub(1,2) == "--" and line:len() > #boundary + 2 and
		     line:sub( 3, 2 + #boundary ) == boundary ) or not in_size
		then
			-- Flush the data of the previous mime part.
			-- When field and/or buffer are set to nil we should discard
			-- the previous section entirely due to format violations.
			if type(field)  == "string" and field:len() > 0 and
			   type(buffer) == "string"
			then
				-- According to the rfc the \r\n preceeding a boundary
				-- is assumed to be part of the boundary itself.
				-- Since we are reading line by line here, this crlf
				-- is part of the last line of our section content,
				-- so strip it before storing the buffer.
				buffer = buffer:gsub("\r?\n$","")

				-- If we're in a file part and a file callback has been provided
				-- then do a final call and send eof.
				if in_file and type(filecb) == "function" then
					filecb( field, filename, buffer, true )
					params[field] = filename

				-- Store buffer.
				else
					params[field] = buffer
				end
			end

			-- Reset vars
			buffer   = ""
			filename = nil
			field    = nil
			in_file  = false

			-- Abort here if we reached maximum allowed size
			if not in_size then break end

			-- Do we got the last boundary?
			if line:len() > #boundary + 4 and
			   line:sub( #boundary + 2, #boundary + 4 ) == "--"
			then
				-- No more processing
				in_part = false

			-- It's a middle boundary
			else

				-- Read headers
				local hlen, headers = extract_headers( reader )

				-- Check for valid headers
				if headers['Content-Disposition'] then

					-- Got no content type header, assume content-type "text/plain"
					if not headers['Content-Type'] then
						headers['Content-Type'] = 'text/plain'
					end

					-- Find field name
					local hdrvals = luci.util.split(
						headers['Content-Disposition'], '; '
					)

					-- Valid form data part?
					if hdrvals[1] == "form-data" and hdrvals[2]:match("^name=") then

						-- Store field identifier
						field = hdrvals[2]:match('^name="(.+)"$')

						-- Do we got a file upload field?
						if #hdrvals == 3 and hdrvals[3]:match("^filename=") then
							in_file  = true
							if_fbeg  = true
							filename = hdrvals[3]:match('^filename="(.+)"$')
						end

						-- Entering next part processing
						in_part = true
					end
				end
			end

		-- Processing content
		elseif in_part then

			-- XXX: Would be really good to switch from line based to
			--      buffered reading here.


			-- If we're in a file part and a file callback has been provided
			-- then call the callback and reset the buffer.
			if in_file and type(filecb) == "function" then

				-- If we're not processing the first chunk, then call 
				if not in_fbeg then
					filecb( field, filename, buffer, false )
					buffer = ""
				
				-- Clear in_fbeg flag after first run
				else
					in_fbeg = false
				end
			end

			-- Append date to buffer
			buffer = buffer .. line
		end
	end

	return params
end


-- Extract "magic", the first line of a http message.
-- Returns the message type ("get", "post" or "response"), the requested uri
-- if it is a valid http request or the status code if the line descripes a 
-- http response. For requests the third parameter is nil, for responses it
-- contains the human readable status description.
function extract_magic( reader )

	for line in reader do
		-- Is it a request?
		local method, uri = line:match("^([A-Z]+) ([^ ]+) HTTP/[01]%.[019]\r?\n$")

		-- Yup, it is
		if method then
			return method:lower(), uri, nil

		-- Is it a response?
		else
			local code, message = line:match("^HTTP/[01]%.[019] ([0-9]+) ([^\r\n]+)\r?\n$")

			-- Is a response
			if code then
				return "response", code + 0, message

			-- Can't handle it
			else
				return nil
			end
		end
	end
end


-- Extract headers from given string.
-- Returns a table of extracted headers and the remainder of the parsed data.
function extract_headers( reader, tbl )

	local headers = tbl or { }
	local count   = 0

	-- Iterate line by line
	for line in reader do

		-- Look for a valid header format
		local hdr, val = line:match( "^([A-Z][A-Za-z0-9%-_]+): +([^\r\n]+)\r?\n$" )

		if type(hdr) == "string" and hdr:len() > 0 and
		   type(val) == "string" and val:len() > 0
		then
			count = count + line:len()
			headers[hdr] = val

		elseif line:match("^\r?\n$") then
			
			return count + line:len(), headers

		else
			-- junk data, don't add length
			return count, headers
		end
	end

	return count, headers
end


-- Parse a http message
function parse_message( data, filecb )

	local reader  = _linereader( data )
	local message = parse_message_header( reader )

	if message then
		parse_message_body( reader, message, filecb )
	end

	return message
end


-- Parse a http message header
function parse_message_header( data )

	-- Create a line reader
	local reader  = _linereader( data )
	local message = { }

	-- Try to extract magic
	local method, arg1, arg2 = extract_magic( reader )

	-- Does it looks like a valid message?
	if method then

		message.request_method = method
		message.status_code    = arg2 and arg1 or 200
		message.status_message = arg2 or nil
		message.request_uri    = arg2 and nil or arg1

		if method == "response" then
			message.type = "response"
		else
			message.type = "request"
		end

		-- Parse headers?
		local hlen, hdrs = extract_headers( reader )

		-- Valid headers?
		if hlen > 2 and type(hdrs) == "table" then

			message.headers = hdrs

			-- Process get parameters
			if ( method == "get" or method == "post" ) and
			   message.request_uri:match("?")
			then
				message.params = urldecode_params( message.request_uri )
			else
				message.params = { }
			end

			-- Populate common environment variables
			message.env = {
				CONTENT_LENGTH    = hdrs['Content-Length'];
				CONTENT_TYPE      = hdrs['Content-Type'];
				REQUEST_METHOD    = message.request_method;
				REQUEST_URI       = message.request_uri;
				SCRIPT_NAME       = message.request_uri:gsub("?.+$","");
				SCRIPT_FILENAME   = ""		-- XXX implement me
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
				local val = hdrs[hdr]

				message.env[var] = val
			end


			return message
		end
	end
end


-- Parse a http message body
function parse_message_body( reader, message, filecb )

	if type(message) == "table" then
		local env = message.env

		local clen = ( env.CONTENT_LENGTH or HTTP_MAX_CONTENT ) + 0
		
		-- Process post method
		if env.REQUEST_METHOD:lower() == "post" and env.CONTENT_TYPE then
			-- Is it multipart/form-data ?
			if env.CONTENT_TYPE:match("^multipart/form%-data") then
				for k, v in pairs( mimedecode(
					reader,
					env.CONTENT_TYPE:match("boundary=(.+)"),
					filecb
				) ) do
					message.params[k] = v
				end

			-- Is it x-www-form-urlencoded?
			elseif env.CONTENT_TYPE:match('^application/x%-www%-form%-urlencoded') then
				-- XXX: readline isn't the best solution here
				for chunk in reader do
					for k, v in pairs( urldecode_params( chunk ) ) do
						message.params[k] = v
					end

					-- XXX: unreliable (undefined line length)
					if clen + chunk:len() >= HTTP_MAX_CONTENT then
						break
					end

					clen = clen + chunk:len()
				end

			-- Unhandled encoding
			-- If a file callback is given then feed it line by line, else
			-- store whole buffer in message.content
			else
				for chunk in reader do

					-- We have a callback, feed it.
					if type(filecb) == "function" then

						filecb( "_post", nil, chunk, false )

					-- Append to .content buffer.
					else
						message.content = 
							type(message.content) == "string"
								and message.content .. chunk
								or chunk
					end

					-- XXX: unreliable
					if clen + chunk:len() >= HTTP_MAX_CONTENT then
						break
					end

					clen = clen + chunk:len()
				end

				-- Send eof to callback
				if type(filecb) == "function" then
					filecb( "_post", nil, "", true )
				end
			end
		end
	end
end


function _linereader( obj )

	-- object is string
	if type(obj) == "string" then

		return obj:gmatch( "[^\r\n]*\r?\n" )

	-- object is a function
	elseif type(obj) == "function" then

		return obj

	-- object is a table and implements a readline() function
	elseif type(obj) == "table" and type(obj.readline) == "function" then

		return obj.readline

	-- object is a table and has a lines property
	elseif type(obj) == "table" and obj.lines then

		-- decide wheather to use "lines" as function or table
		local _lns = ( type(obj.lines) == "function" ) and obj.lines() or obj.lines
		local _pos = 1
		
		return function()
			if _pos <= #_lns then
				_pos = _pos + 1
				return _lns[_pos]
			end
		end

	-- no usable data type
	else

		-- dummy iterator
		return function()
			return nil
		end
	end
end
