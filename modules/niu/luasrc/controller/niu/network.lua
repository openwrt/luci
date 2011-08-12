--[[
LuCI - Lua Development Framework

Copyright 2009 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--

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
	 			toniu), "Manage Address Assignment", 30)
	 	end
	end)
	 
	 if fs.access("/etc/config/ddns") then
		entry({"niu", "network", "ddns"},  cbi("niu/network/ddns", toniu),
		 "Configure Dynamic-DNS names", 60)		
	 end
end
