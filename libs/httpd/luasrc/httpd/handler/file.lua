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
	local file = self.docroot .. request.env.REQUEST_URI:gsub("../", "")
	local size = luci.fs.stat(file, "size")
	if size then
		return Response(200, {["Content-Length"] = size}), ltn12.source.file(io.open(file))
	else
		return Response(404)
	end
end