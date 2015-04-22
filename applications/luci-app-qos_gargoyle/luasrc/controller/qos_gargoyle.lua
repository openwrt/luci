--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id: qos.lua 9558 2012-12-18 13:58:22Z jow $
]]--

module("luci.controller.qos_gargoyle", package.seeall)

function index()
	if not nixio.fs.access("/etc/config/qos_gargoyle") then
		return
	end

	local page

	page = entry({"admin", "network", "qos_gargoyle"},
		alias("admin", "network", "qos_gargoyle", "global"),
		_("Qos_Gargoyle"), 60)

	page = entry({"admin", "network", "qos_gargoyle", "global"},
		arcombine(cbi("qos_gargoyle/global")),
		_("global"), 20)

	page = entry({"admin", "network", "qos_gargoyle", "upload"},
		arcombine(cbi("qos_gargoyle/upload")),
		_("UpLoad Set"),30)

	page = entry({"admin", "network", "qos_gargoyle", "download"},
		arcombine(cbi("qos_gargoyle/download")),
		_("DownLoad Set"), 40)
end
