--[[

HTTP protocol implementation for LuCI - filter implementation
(c) 2008 Freifunk Leipzig / Jo-Philipp Wich <xm@leipzig.freifunk.net>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

$Id$

]]--

module("luci.http.protocol.filter", package.seeall)

local ltn12 = require("luci.ltn12")


-- Factory that produces a filter which normalizes chunked transfer encoding
function decode_chunked()

	local length = 0
	local read   = 0

	return ltn12.filter.cycle(
		function( chunk, ctx )

			if chunk ~= nil then

				-- EOF
				if ctx == nil then
					if ( length - read ) > 0 then
						return nil, "Unexpected EOF"
					else
						return ""
					end
				end

				chunk = ctx .. chunk

				local buf = ""
				while true do

					if read == length then

						-- Find chunk length indicator
						local spos, epos = chunk:find("^\r?\n?[a-fA-F0-9]+ *\r\n")
						if spos and spos == 1 then
							read   = 0
							length = tonumber(
								chunk:sub( 1, epos ):gsub( "[^a-fA-F0-9]", "" ), 16
							)

							-- Check for end of chunk
							if length > 0 then
								chunk = chunk:sub( epos + 1, #chunk )
							else
								return buf, ""
							end
						else
							return "", nil
						end
					else
						if ( read + #chunk ) <= length then
							read = read + #chunk
							return buf .. chunk, ""
						else
							local rest = length - read
							read  = read + rest
							buf   = buf .. chunk:sub( 1, rest )
							chunk = chunk:sub( rest + 1, #chunk )
						end
					end
				end
			end
		end,
		""
	)
end
