--[[
dns2socks Luci configuration page.Made by 981213
]]--

module("luci.controller.dns2socks", package.seeall)

function index()
	
	if not nixio.fs.access("/etc/config/dns2socks") then
		return
	end

	local page
	page = entry({"admin", "services", "dns2socks"}, cbi("dns2socks"), _("DNS2Socks"), 45)
	page.dependent = true
end
