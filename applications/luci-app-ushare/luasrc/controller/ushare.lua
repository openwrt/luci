-- Copyright 2008 Yanira <forum-2008@email.de>
-- Licensed to the public under the Apache License 2.0.

module("luci.controller.ushare", package.seeall)

function index()
	if not nixio.fs.access("/etc/config/ushare") then
		return
	end

	local page

	page = entry({"admin", "services", "ushare"}, cbi("ushare"), _("uShare"), 60)
	page.dependent = true
end
