--[[
LuCI - Lua Configuration Interface

Copyright 2011 Manuel Munz <freifunk somakoma de>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

]]--

module "luci.controller.meshwizard"

function index()
	require("luci.i18n").loadc("meshwizard")
	local i18n = luci.i18n.translate
	entry({"admin", "freifunk", "meshwizard"}, cbi("freifunk/meshwizard"), i18n("Mesh Wizard"), 40)
end

