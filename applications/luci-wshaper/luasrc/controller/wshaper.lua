--[[
LuCI - Lua Configuration Interface

Copyright 2011 Manuel Munz <freifunk somakoma de>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

]]--

module "luci.controller.wshaper"

function index()
	entry({"admin", "network", "wshaper"}, cbi("wshaper"), _("Wondershaper"), 80)
end

