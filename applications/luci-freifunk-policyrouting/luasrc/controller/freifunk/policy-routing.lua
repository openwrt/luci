--[[
LuCI - Lua Configuration Interface

Copyright 2011 Manuel Munz <freifunk at somakoma de>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0
]]--


module "luci.controller.freifunk.policy-routing"

function index()
	require("luci.i18n").loadc("freifunk-policyrouting")
	local i18n = luci.i18n.translate

	entry({"admin", "freifunk", "policyrouting"}, cbi("freifunk/policyrouting"), i18n("Policy Routing"), 60)
end


