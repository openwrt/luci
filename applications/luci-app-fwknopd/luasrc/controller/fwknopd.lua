-- Copyright 2015 Jonathan Bennett <jbennett@incomsystems.biz>
-- Licensed to the public under the Apache License 2.0.

module("luci.controller.fwknopd", package.seeall)

function index()
	if not nixio.fs.access("/etc/config/fwknopd") then
		return
	end

	local page

	page = entry({"admin", "services", "fwknopd"}, cbi("fwknopd"), _("Firewall Knock Daemon"))
	page.dependent = true
end
