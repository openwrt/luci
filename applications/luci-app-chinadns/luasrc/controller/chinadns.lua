--[[
openwrt-dist-luci: ChinaDNS
]]--

module("luci.controller.chinadns", package.seeall)

function index()
	if not nixio.fs.access("/etc/config/chinadns") then
		return
	end

	entry({"admin", "services", "chinadns"}, cbi("chinadns"), _("ChinaDNS"), 70).dependent = true
end
