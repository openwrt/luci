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
	entry({"niu", "network"}, nil, "Network", 10).dbtemplate = "niu/network"

	entry({"niu", "network", "wan"}, 
	cbi("niu/network/wan", {on_success_to={"niu"}}), "Configure Internet Connection", 10)

	entry({"niu", "network", "lan"}, 
	cbi("niu/network/lan", {on_success_to={"niu"}}), "Configure Local Network", 20)
	
	uci.inst_state:foreach("dhcp", "dhcp", function(s)
		if s.interface == "lan" and s.ignore ~= "1" then 
			entry({"niu", "network", "assign"}, cbi("niu/network/assign",
	 			{on_success_to={"niu"}}), "Assign local addresses", 30)
	 	end
	end)
	
	entry({"niu", "network", "routes"},  cbi("niu/network/routes",
	 {on_success_to={"niu"}}), "Assign custom routes", 40)
end
