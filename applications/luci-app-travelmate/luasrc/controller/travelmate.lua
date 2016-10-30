-- Licensed to the public under the Apache License 2.0.

module("luci.controller.travelmate", package.seeall)

function index()
	if not nixio.fs.access("/etc/config/travelmate") then
		return
	end

	entry({"admin", "services", "travelmate"}, cbi("travelmate"), _("Travelmate"), 60)
end
