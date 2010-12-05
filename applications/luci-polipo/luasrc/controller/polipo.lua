--[[
LuCI - Lua Configuration Interface

Copyright 2008 Aleksandar Krsteski <alekrsteski@gmail.com>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--
module("luci.controller.polipo", package.seeall)

function index()
	if not nixio.fs.access("/etc/config/polipo") then
		return
	end

	require("luci.i18n").loadc("polipo")
	local i18n = luci.i18n.translate

	entry({"admin", "services", "polipo"}, alias("admin", "services", "polipo", "config"), "Polipo").i18n = "polipo"
	entry({"admin", "services", "polipo", "status"}, template("polipo_status"), i18n("Status"))
	entry({"admin", "services", "polipo", "config"}, cbi("polipo"), i18n("Configuration"))
end

