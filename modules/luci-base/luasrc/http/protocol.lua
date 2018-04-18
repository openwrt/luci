-- Copyright 2008-2018 Jo-Philipp Wich <jo@mein.io>
-- Licensed to the public under the Apache License 2.0.

-- This class contains several functions useful for http message- and content
-- decoding and to retrive form data from raw http messages.

local require, type, tonumber = require, type, tonumber
local table, pairs, ipairs, pcall = table, pairs, ipairs, pcall

module "luci.http.protocol"

local ltn12 = require "luci.ltn12"
local lhttp = require "lucihttp"

HTTP_MAX_CONTENT      = 1024*8		-- 8 kB maximum content size

-- from given url or string. Returns a table with urldecoded values.
-- Simple parameters are stored as string values associated with the parameter
-- name within the table. Parameters with multiple values are stored as array
-- containing the corresponding values.
function urldecode_params(url, tbl)
	local parser, name
	local params = tbl or { }

	parser = lhttp.urlencoded_parser(function (what, buffer, length)
		if what == parser.TUPLE then
			name, value = nil, nil
		elseif what == parser.NAME then
			name = lhttp.urldecode(buffer)
		elseif what == parser.VALUE and name then
			params[name] = lhttp.urldecode(buffer) or ""
		end

		return true
	end)

	if parser then
		parser:parse((url or ""):match("[^?]*$"))
		parser:parse(nil)
	end

	return params
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

-- Content-Type. Stores all extracted data associated with its parameter name
-- in the params table within the given message object. Multiple parameter
-- values are stored as tables, ordinary ones as strings.
-- If an optional file callback function is given then it is feeded with the
-- file contents chunk by chunk and only the extracted file name is stored
-- within the params table. The callback function will be called subsequently
-- with three arguments:
--  o Table containing decoded (name, file) and raw (headers) mime header data
--  o String value containing a chunk of the file data
--  o Boolean which indicates wheather the current chunk is the last one (eof)
function mimedecode_message_body(src, msg, file_cb)
	local parser, header, field
	local len, maxlen = 0, tonumber(msg.env.CONTENT_LENGTH or nil)

	parser, err = lhttp.multipart_parser(msg.env.CONTENT_TYPE, function (what, buffer, length)
		if what == parser.PART_INIT then
			field = { }

		elseif what == parser.HEADER_NAME then
			header = buffer:lower()

		elseif what == parser.HEADER_VALUE and header then
			if header:lower() == "content-disposition" and
			   lhttp.header_attribute(buffer, nil) == "form-data"
			then
				field.name = lhttp.header_attribute(buffer, "name")
				field.file = lhttp.header_attribute(buffer, "filename")
			end

			if field.headers then
				field.headers[header] = buffer
			else
				field.headers = { [header] = buffer }
			end

		elseif what == parser.PART_BEGIN then
			return not field.file

		elseif what == parser.PART_DATA and field.name and length > 0 then
			if field.file then
				if file_cb then
					file_cb(field, buffer, false)
					msg.params[field.name] = msg.params[field.name] or field
				else
					if not field.fd then
						local ok, nx = pcall(require, "nixio")
						field.fd = ok and nx.mkstemp(field.name)
					end

					if field.fd then
						field.fd:write(buffer)
						msg.params[field.name] = msg.params[field.name] or field
					end
				end
			else
				field.value = buffer
			end

		elseif what == parser.PART_END and field.name then
			if field.file and msg.params[field.name] then
				if file_cb then
					file_cb(field, "", true)
				elseif field.fd then
					field.fd:seek(0, "set")
				end
			else
				msg.params[field.name] = field.value or ""
			end

			field = nil

		elseif what == parser.ERROR then
			err = buffer
		end

		return true
	end)

	return ltn12.pump.all(src, function (chunk)
		len = len + (chunk and #chunk or 0)

		if maxlen and len > maxlen + 2 then
			return nil, "Message body size exceeds Content-Length"
		end

		if not parser or not parser:parse(chunk) then
			return nil, err
		end

		return true
	end)
end

-- Content-Type. Stores all extracted data associated with its parameter name
-- in the params table within the given message object. Multiple parameter
-- values are stored as tables, ordinary ones as strings.
function urldecode_message_body(src, msg)
	local err, name, value, parser
	local len, maxlen = 0, tonumber(msg.env.CONTENT_LENGTH or nil)

	parser = lhttp.urlencoded_parser(function (what, buffer, length)
		if what == parser.TUPLE then
			name, value = nil, nil
		elseif what == parser.NAME then
			name = lhttp.urldecode(buffer)
		elseif what == parser.VALUE and name then
			msg.params[name] = lhttp.urldecode(buffer) or ""
		elseif what == parser.ERROR then
			err = buffer
		end

		return true
	end)

	return ltn12.pump.all(src, function (chunk)
		len = len + (chunk and #chunk or 0)

		if maxlen and len > maxlen + 2 then
			return nil, "Message body size exceeds Content-Length"
		elseif len > HTTP_MAX_CONTENT then
			return nil, "Message body size exceeds maximum allowed length"
		end

		if not parser or not parser:parse(chunk) then
			return nil, err
		end

		return true
	end)
end

-- This function will examine the Content-Type within the given message object
-- to select the appropriate content decoder.
-- Currently the application/x-www-urlencoded and application/form-data
-- mime types are supported. If the encountered content encoding can't be
-- handled then the whole message body will be stored unaltered as "content"
-- property within the given message object.
function parse_message_body(src, msg, filecb)
	local ctype = lhttp.header_attribute(msg.env.CONTENT_TYPE, nil)

	-- Is it multipart/mime ?
	if msg.env.REQUEST_METHOD == "POST" and
	   ctype == "multipart/form-data"
	then
		return mimedecode_message_body( src, msg, filecb )

	-- Is it application/x-www-form-urlencoded ?
	elseif msg.env.REQUEST_METHOD == "POST" and
	       ctype == "application/x-www-form-urlencoded"
	then
		return urldecode_message_body( src, msg, filecb )


	-- Unhandled encoding
	-- If a file callback is given then feed it chunk by chunk, else
	-- store whole buffer in message.content
	else

		local sink

		-- If we have a file callback then feed it
		if type(filecb) == "function" then
			local meta = {
				name = "raw",
				encoding = msg.env.CONTENT_TYPE
			}
			sink = function( chunk )
				if chunk then
					return filecb(meta, chunk, false)
				else
					return filecb(meta, nil, true)
				end
			end
		-- ... else append to .content
		else
			msg.content = ""
			msg.content_length = 0

			sink = function( chunk )
				if chunk then
					if ( msg.content_length + #chunk ) <= HTTP_MAX_CONTENT then
						msg.content        = msg.content        .. chunk
						msg.content_length = msg.content_length + #chunk
						return true
					else
						return nil, "POST data exceeds maximum allowed length"
					end
				end
				return true
			end
		end

		-- Pump data...
		while true do
			local ok, err = ltn12.pump.step( src, sink )

			if not ok and err then
				return nil, err
			elseif not ok then -- eof
				return true
			end
		end

		return true
	end
end
