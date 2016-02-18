-- Copyright 2016 Openwrt.org
-- Licensed to the public under the Apache License 2.0.

module("luci.controller.adblock", package.seeall)

function index()
	if not nixio.fs.access("/etc/config/adblock") then
		return
	end

	entry({"admin", "services", "adblock"}, cbi("adblock"), _("Adblock"), 40)
end
