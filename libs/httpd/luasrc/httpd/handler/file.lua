module("luci.httpd.handler.file", package.seeall)
require("luci.httpd.module")
require("luci.fs")
require("ltn12")

Simple = luci.util.class(luci.httpd.module.Handler)
Response = luci.httpd.module.Response

function Simple.__init__(self, docroot)
	luci.httpd.module.Handler.__init__(self)
	self.docroot = docroot
end

function Simple.getfile(self, uri)
	local file = self.docroot .. uri:gsub("%.%./", "")
	local stat = luci.fs.stat(file)
	
	return file, stat
end

function Simple.handle_get(self, request, sourcein, sinkerr)
	local file, stat = self:getfile(request.env.PATH_INFO)

	if stat then
		if stat.type == "regular" then
			return Response(200, {["Content-Length"] = stat.size}), ltn12.source.file(io.open(file))
		else
			return self:failure(403, "Unable to transmit " .. stat.type .. " " .. request.env.PATH_INFO)
		end
	else
		return self:failure(404, "No such file: " .. uri)
	end
end

function Simple.handle_head(self, ...)
	local response, sourceout = self:handle_get(...)
	return response
end