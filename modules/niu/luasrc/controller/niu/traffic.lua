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
module "luci.controller.niu.traffic"

function index()
	local toniu = {on_success_to={"niu"}}
	
	local e = entry({"niu", "traffic"}, alias("niu"), "Network Traffic", 30)
	e.niu_dbtemplate = "niu/traffic"
	e.niu_dbtasks = true
	e.niu_dbicon = "icons32/preferences-system-network.png"
	
	if fs.access("/etc/config/firewall") then
		entry({"niu", "traffic", "portfw"}, cbi("niu/traffic/portfw",
	 	 toniu), "Manage Port Forwarding", 1)
	end
	
	if fs.access("/etc/config/qos") then
		entry({"niu", "traffic", "qos"}, cbi("niu/traffic/qos",
	 	 toniu), "Manage Prioritization (QoS)", 2)
	end
	
	entry({"niu", "traffic", "routes"},  cbi("niu/traffic/routes",
	 toniu), "Manage Traffic Routing", 30)
	 
	entry({"niu", "traffic", "conntrack"},  call("cnntrck"),
	 "Display Local Network Activity", 50)
end

function cnntrck()
	require "luci.template".render("niu/traffic/conntrack")
end
