module("luci.httpd.FileHandler", package.seeall)
require("luci.util")
require("luci.fs")
require("ltn12")

SimpleHandler = luci.util.class(luci.httpd.Handler)

function SimpleHandler.__init__(self, docroot)
	luci.httpd.Handler.__init__(self)
	self.docroot = docroot
end

function SimpleHandler.handle(self, request)
	local response = luci.httpd.Response()
	local f = self.docroot .. "/" .. request.request_uri:gsub("%.%./", "")
	request.error:write("Requested " .. f .. "\n")
	local s = luci.fs.stat(f, "size")
	if s then
		response:addheader("Content-Length", s)
		response:setsource(ltn12.source.file(io.open(f)))
	else
		response:setstatus(404)
	end
end