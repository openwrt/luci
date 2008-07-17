--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>
Copyright 2008 Jo-Philipp Wich <xm@leipzig.freifunk.net>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--
module("luci.controller.upnp", package.seeall)

function index()
	if not luci.fs.isfile("/etc/config/upnpd") then
		return
	end
	
	local page = entry({"admin", "services", "upnp"}, cbi("upnp/upnp"), "UPNP")
	page.i18n = "upnp"
	page.dependent = true
	
	
	local page = entry({"mini", "network", "upnp"}, cbi("upnp/upnpmini"), "UPNP")
	page.i18n = "upnp"
	page.dependent = true
end