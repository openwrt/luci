-- Copyright 2018 Rosy Song <rosysong@rosinson.com>
-- Licensed to the public under the Apache License 2.0.

module("luci.controller.rosy-file-server.rosy-file-server", package.seeall)

function index()
	if not nixio.fs.access("/etc/config/rosyfs") then
		return
	end

	local root = node()
	if not root.target then
		root.target = alias("httpfs")
		root.index = true
	end

	page          = node()
	page.lock     = true
	page.target   = alias("httpfs")
	page.subindex = true
	page.index    = false

	page          = node("httpfs")
	page.title    = _("Rosy File Server")
	page.target   = alias("httpfs", "rosy-file-server")
	page.order    = 5
	page.setuser  = "root"
	page.setgroup = "root"
	page.index    = true

	entry({"httpfs", "rosy-file-server"},
		form("rosy-file-server/rosy-file-server"), _("Rosy File Server"), 10)
	entry({"httpfs", "file-server-download"},
		post("action_download"), nil)

	entry({"admin", "services", "rosyfs"},
		cbi("rosy-file-server/rosyfs"), _("Rosy File Server"), 61)
end

function action_download()
	local p = luci.http.formvalue("path") or ""
	local n = luci.http.formvalue("name") or ""

	if not p or not n then
		luci.http.status(400, "Bad Request")
		return
	end

	luci.http.header('Content-Disposition', 'attachment; filename="%s"' % n)
	luci.http.prepare_content("application/octet-stream")
	luci.sys.process.exec({ "/bin/dd", "if=%s%s" % { p, n }, "conv=fsync,notrunc" }, luci.http.write)
end
