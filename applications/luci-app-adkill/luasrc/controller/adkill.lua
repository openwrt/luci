--[[
 adkill配置页面 Controller
 Copyright (C) 2015 GuoGuo <gch981213@gmail.com>
]]--

module("luci.controller.adkill", package.seeall)

function index()

	if not nixio.fs.access("/etc/config/adkill") then
		return
	end
	entry({"admin", "services", "adkill"}, cbi("adkill"), _("Ad-Killer"), 56).dependent = true

end
