--[[
LuCI - Lua Development Framework

Copyright 2009 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--

local require = require
module "luci.controller.niu.network"

function index()
	local toniu = {on_success_to={"niu"}}
	
	local e = entry({"niu", "network"}, alias("niu"), "Network", 10)
	e.niu_dbtemplate = "niu/network"
	e.niu_dbtasks = true
	e.niu_dbicon = "icons32/network-workgroup.png"

	entry({"niu", "network", "wan"}, 
	cbi("niu/network/wan", toniu), "Configure Internet Connection", 1)

	entry({"niu", "network", "lan"}, 
	cbi("niu/network/lan", toniu), "Configure Local Network", 2)
	
	uci.inst_state:foreach("dhcp", "dhcp", function(s)
		if s.interface == "lan" and s.ignore ~= "1" then 
			entry({"niu", "network", "assign"}, cbi("niu/network/assign",
	 			toniu), "Display and Customize Address Assignment", 30)
	 	end
	end)
	
	entry({"niu", "network", "routes"},  cbi("niu/network/routes",
	 toniu), "Display and Customize Routing", 40)
	 
	entry({"niu", "network", "conntrack"},  call("cnntrck"),
	 "Display Local Network Activity", 50)
	 
	 if fs.access("/etc/config/ddns") then
		entry({"niu", "network", "ddns"},  cbi("niu/network/ddns", toniu),
		 "Configure Dynamic-DNS names", 60)		
	 end
end

function cnntrck()
	require "luci.template".render("niu/network/conntrack")
end
