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
	if not luci.fs.access("/etc/config/polipo") then
		return
	end
	
	require("luci.i18n")
	luci.i18n.loadc("polipo")
	local i18n = luci.i18n.translate
	
	local p = entry({"admin", "services", "polipo"}, cbi("polipo"), i18n("polipo", "Polipo"))
	p.dependent = true
	p.i18n = "polipo"
end
