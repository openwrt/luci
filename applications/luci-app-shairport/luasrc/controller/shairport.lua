-- Copyright 2014 Álvaro Fernández Rojas <noltari@gmail.com>
-- Licensed to the public under the Apache License 2.0.

module("luci.controller.shairport", package.seeall)

function index()
	if not nixio.fs.access("/etc/config/shairport") then
		return
	end

	local page = entry({"admin", "services", "shairport"}, cbi("shairport"), _("Shairport"))
	page.dependent = true

end
