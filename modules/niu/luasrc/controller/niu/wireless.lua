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
module "luci.controller.niu.wireless"

function index()
	if not fs.access("/etc/config/wireless") then
		return
	end


	local toniu = {on_success_to={"niu"}}
	
	local e = entry({"niu", "wireless"}, alias("niu"), "Wireless", 20)
	--e.niu_dbtemplate = "niu/wireless"
	e.niu_dbtasks = true
	e.niu_dbicon = "icons32/network-wireless.png"

	entry({"niu", "wireless", "ap"}, 
	cbi("niu/wireless/ap", toniu), "Configure Private Access Point", 1)
end