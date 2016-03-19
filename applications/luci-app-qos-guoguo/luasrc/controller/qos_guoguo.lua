--[[
luci for QoS by GuoGuo
Based on luci-app-qos-gargoyle.
]]--

module("luci.controller.qos_guoguo", package.seeall)

function index()
	if not nixio.fs.access("/etc/config/qos_guoguo") then
		return
	end

	local page

	page = entry({"admin", "network", "qos_guoguo"},
		alias("admin", "network", "qos_guoguo", "general"),
		_("QoS by GuoGuo"), 60)

	page = entry({"admin", "network", "qos_guoguo", "general"},
		arcombine(cbi("qos_guoguo/general")),
		_("General Settings"), 20)

	page = entry({"admin", "network", "qos_guoguo", "upload"},
		arcombine(cbi("qos_guoguo/upload")),
		_("Upload Settings"),30)

	page = entry({"admin", "network", "qos_guoguo", "download"},
		arcombine(cbi("qos_guoguo/download")),
		_("Download Settings"), 40)
end
