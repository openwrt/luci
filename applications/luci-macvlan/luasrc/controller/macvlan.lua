--[[
Macvlan Luci configuration page.Made by 981213
]]--

module("luci.controller.macvlan", package.seeall)

function index()
	
	if not nixio.fs.access("/etc/config/macvlan") then
		return
	end

	local page
	page = entry({"admin", "network", "macvlan"}, cbi("macvlan"), _("Virtual WAN"), 45)
	page.dependent = true

	page = entry({"admin", "network", "macvlan_rediag"}, call("rediag"), nil)
	page.leaf = true

end

function rediag()
	os.execute("/etc/init.d/ppp_syncdiag restart")
end
