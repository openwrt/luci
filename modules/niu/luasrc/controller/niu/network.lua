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
module "luci.controller.niu.network"

function index()
	entry({"niu", "network"}, alias("admin", "network"), "Network")
	.dbtemplate = "niu/network"

	entry({"niu", "network", "lan"}, 
	cbi("niu/network/lan", {on_success_to={"niu"}}), "Configure LAN")

	entry({"niu", "network", "wan"}, 
	cbi("niu/network/wan", {on_success_to={"niu"}}), "Configure Internet")
end
