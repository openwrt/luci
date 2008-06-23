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

function Simple.handle(self, request, sourcein, sinkerr)
	local uri  = request.env.PATH_INFO
	local file = self.docroot .. uri:gsub("%.%./", "")
	local stat = luci.fs.stat(file)

	if stat then
		if stat.type == "regular" then
			return Response(200, {["Content-Length"] = stat.size}), ltn12.source.file(io.open(file))
		else
			return self:failure(403, "Unable to transmit " .. stat.type .. " " .. uri)
		end
	else
		return self:failure(404, "No such file: " .. uri)
	end
end