--[[
Shadowsocks Luci configuration page.Made by 981213
]]--

module("luci.controller.shadowsocks", package.seeall)

function index()
	
	if not nixio.fs.access("/etc/config/shadowsocks") then
		return
	end

	local page
	page = entry({"admin", "services", "shadowsocks"}, cbi("shadowsocks"), _("Shadowsocks"), 45)
	page.dependent = true
end
