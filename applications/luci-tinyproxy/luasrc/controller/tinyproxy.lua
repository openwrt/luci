--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>
Copyright 2008 Jo-Philipp Wich <xm@leipzig.freifunk.net>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--

module("luci.controller.tinyproxy", package.seeall)

function index()
	if not nixio.fs.access("/etc/config/tinyproxy") then
		return
	end

	require("luci.i18n").loadc("tinyproxy")
	local i18n = luci.i18n.translate

	entry({"admin", "services", "tinyproxy"}, alias("admin", "services", "tinyproxy", "config"), "Tinyproxy").i18n = "tinyproxy"
	entry({"admin", "services", "tinyproxy", "status"}, template("tinyproxy_status"), i18n("Status"))
	entry({"admin", "services", "tinyproxy", "config"}, cbi("tinyproxy"), i18n("Configuration"))
end
