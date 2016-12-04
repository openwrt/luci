-- Copyright 2008 Steven Barth <steven@midlink.org>
-- Copyright 2008 Jo-Philipp Wich <jow@openwrt.org>
-- Licensed to the public under the Apache License 2.0.

module("luci.controller.unbound", package.seeall)

function index()
	if not nixio.fs.access("/etc/config/unbound") then
		return
	end

	local page

	page = entry({"admin", "services", "unbound"}, cbi("unbound"), _("Recursive DNS"))
	page.dependent = true
end

