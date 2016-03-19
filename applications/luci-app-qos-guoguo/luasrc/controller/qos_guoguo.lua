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

	page = entry({"admin", "network", "qos_gargoyle", "general"},
		arcombine(cbi("qos_gargoyle/general")),
		_("global"), 20)

	page = entry({"admin", "network", "qos_gargoyle", "upload"},
		arcombine(cbi("qos_gargoyle/general")),
		_("UpLoad Set"),30)

	page = entry({"admin", "network", "qos_gargoyle", "download"},
		arcombine(cbi("qos_gargoyle/general")),
		_("DownLoad Set"), 40)
end
