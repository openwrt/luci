-- Copyright 2008 Yanira <forum-2008@email.de>
-- Licensed to the public under the Apache License 2.0.

module("luci.controller.mmc_over_gpio", package.seeall)

function index()
	if not nixio.fs.access("/etc/config/mmc_over_gpio") then
		return
	end

	local page

	page = entry({"admin", "system", "mmc_over_gpio"}, cbi("mmc_over_gpio"), _("MMC/SD driver configuration"), 60)
	page.dependent = true
end
