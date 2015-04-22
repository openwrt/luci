--[[
 Redsocks2配置页面 Controller
 Copyright (C) 2015 GuoGuo <gch981213@gmail.com>
]]--

module("luci.controller.redsocks2", package.seeall)

function index()

	if not nixio.fs.access("/etc/config/redsocks2") then
		return
	end

	entry({"admin", "services", "redsocks2"},
		alias("admin", "services", "redsocks2", "general"),
		_("Redsocks2"))

	entry({"admin", "services", "redsocks2", "general"},
		cbi("redsocks2/general"),
		_("General Settings"), 10).leaf = true

	entry({"admin", "services", "redsocks2", "advanced"},
		cbi("redsocks2/advanced"),
		_("Advanced Options"), 20).leaf = true

end
