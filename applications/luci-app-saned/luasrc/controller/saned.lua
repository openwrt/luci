-- Copyright 2015 Daniel Dickinson <openwrt@daniel.thecshore.com>
-- Licensed to the public under the Apache License 2.0.

module("luci.controller.saned", package.seeall)

function index()
	if not nixio.fs.access("/etc/config/saned") then
		return
	end

	local page

	page = entry({"admin", "services", "saned"}, cbi("saned"), _("SANE Daemon"))
	page.dependent = true

end

