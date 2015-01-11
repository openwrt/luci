--[[
N2N V2 Luci configuration page.Made by 981213
]]--

module("luci.controller.n2n_v2", package.seeall)

function index()
	
	if not nixio.fs.access("/etc/config/n2n_v2") then
		return
	end

	local page
	page = entry({"admin", "services", "n2n_v2"}, cbi("n2n_v2"), _("N2N VPN(V2)"), 45)
	page.dependent = true
end
