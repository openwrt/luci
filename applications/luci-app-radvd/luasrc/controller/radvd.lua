-- Copyright 2010 Jo-Philipp Wich <jow@openwrt.org>
-- Licensed to the public under the Apache License 2.0.

module("luci.controller.radvd", package.seeall)

function index()
	if not nixio.fs.access("/etc/config/radvd") then
		return
	end

	entry({"admin", "network", "radvd"}, cbi("radvd"), _("Radvd"), 61)
	entry({"admin", "network", "radvd", "interface"}, cbi("radvd/interface"), nil).leaf = true
	entry({"admin", "network", "radvd", "prefix"}, cbi("radvd/prefix"), nil).leaf = true
	entry({"admin", "network", "radvd", "route"}, cbi("radvd/route"), nil).leaf = true
	entry({"admin", "network", "radvd", "rdnss"}, cbi("radvd/rdnss"), nil).leaf = true
	entry({"admin", "network", "radvd", "dnssl"}, cbi("radvd/dnssl"), nil).leaf = true
end
