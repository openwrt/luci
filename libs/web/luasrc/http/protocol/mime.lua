--[[

HTTP protocol implementation for LuCI - mime handling
(c) 2008 Freifunk Leipzig / Jo-Philipp Wich <xm@leipzig.freifunk.net>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

$Id$

]]--

--- LuCI http protocol implementation - mime helper class.
-- This class provides functions to guess mime types from file extensions and
-- vice versa.
module("luci.http.protocol.mime", package.seeall)

require("luci.util")

--- MIME mapping table containg extension - mimetype relations.
-- @class table
MIME_TYPES = {
    ["txt"]   = "text/plain";
    ["js"]    = "text/javascript";
    ["css"]   = "text/css";
    ["htm"]   = "text/html";
    ["html"]  = "text/html";
    ["patch"] = "text/x-patch";
    ["c"]     = "text/x-csrc";
    ["h"]     = "text/x-chdr";
    ["o"]     = "text/x-object";
    ["ko"]    = "text/x-object";

    ["bmp"]   = "image/bmp";
    ["gif"]   = "image/gif";
    ["png"]   = "image/png";
    ["jpg"]   = "image/jpeg";
    ["jpeg"]  = "image/jpeg";
    ["svg"]   = "image/svg+xml";

    ["zip"]   = "application/zip";
    ["pdf"]   = "application/pdf";
    ["xml"]   = "application/xml";
    ["xsl"]   = "application/xml";
    ["doc"]   = "application/msword";
    ["ppt"]   = "application/vnd.ms-powerpoint";
    ["xls"]   = "application/vnd.ms-excel";
    ["odt"]   = "application/vnd.oasis.opendocument.text";
    ["odp"]   = "application/vnd.oasis.opendocument.presentation";
    ["pl"]    = "application/x-perl";
    ["sh"]    = "application/x-shellscript";
    ["php"]   = "application/x-php";
    ["deb"]   = "application/x-deb";
    ["iso"]   = "application/x-cd-image";
    ["tgz"]   = "application/x-compressed-tar";

    ["mp3"]   = "audio/mpeg";
    ["ogg"]   = "audio/x-vorbis+ogg";
    ["wav"]   = "audio/x-wav";

    ["mpg"]   = "video/mpeg";
    ["mpeg"]  = "video/mpeg";
    ["avi"]   = "video/x-msvideo";
}

--- Extract extension from a filename and return corresponding mime-type or
-- "application/octet-stream" if the extension is unknown.
-- @param filename	The filename for which the mime type is guessed
-- @return			String containign the determined mime type
function to_mime(filename)
	if type(filename) == "string" then
		local ext = filename:match("[^%.]+$")

		if ext and MIME_TYPES[ext:lower()] then
			return MIME_TYPES[ext:lower()]
		end
	end

	return "application/octet-stream"
end

--- Return corresponding extension for a given mime type or nil if the
-- given mime-type is unknown.
-- @param mimetype	The mimetype to retrieve the extension from
-- @return			String with the extension or nil for unknown type
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
