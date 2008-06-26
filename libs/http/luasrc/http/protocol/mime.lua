--[[

HTTP protocol implementation for LuCI - mime handling
(c) 2008 Freifunk Leipzig / Jo-Philipp Wich <xm@leipzig.freifunk.net>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

$Id$

]]--

module("luci.http.protocol.mime", package.seeall)

-- MIME mapping
MIME_TYPES = {
    ["txt"]   = "text/plain";
    ["js"]    = "text/javascript";
    ["css"]   = "text/css";
    ["htm"]   = "text/html";
    ["html"]  = "text/html";

    ["gif"]   = "image/gif";
    ["png"]   = "image/png";
    ["jpg"]   = "image/jpeg";
    ["jpeg"]  = "image/jpeg";

    ["xml"]   = "application/xml";
}

-- extract extension from a filename and return corresponding mime-type or
-- "application/octet-stream" if the extension is unknown
function to_mime(filename)
	if type(filename) == "string" then
		local ext = filename:match("[^%.]+$")

		if ext and MIME_TYPES[ext:lower()] then
			return MIME_TYPES[ext:lower()]
		end
	end

	return "application/octet-stream"
end

-- return corresponding extension for a given mime type or nil if the
-- given mime-type is unknown
function to_ext(mimetype)
	if type(mimetype) == "string" then
		for ext, type in luci.util.kspairs( MIME_TYPES ) do
			if type == mimetype then
				return ext
			end
		end
	end

	return nil
end
