--[[
LuCI - Lua Development Framework

Copyright 2009 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--

local req = require
module "luci.controller.niu.system"

function index()
	entry({"niu", "system"}, nil, "System").dbtemplate = "niu/system"

	entry({"niu", "system", "general"}, 
	cbi("niu/system/general", {on_success_to={"niu"}}), "General", 10)
end
