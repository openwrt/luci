-- Licensed to the public under the Apache License 2.0.

module("luci.controller.cifsd", package.seeall)

function index()
	if not nixio.fs.access("/etc/config/cifsd") then
		return
	end

	entry({"admin", "services", "cifsd"}, view("cifsd"), _("Network Shares")).dependent = true
end
