--[[
LuCI - Lua Configuration Interface

Copyright 2010 Jo-Philipp Wich <xm@subsignal.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--

module("luci.controller.radvd", package.seeall)

function index()
	if not nixio.fs.access("/etc/config/radvd") then
		return
	end

	entry({"admin", "network", "radvd"}, cbi("radvd"), _("Radvd"), 61)
	entry({"admin", "network", "radvd", "interface"}, cbi("radvd/interface"), nil).leaf = true
	entry({"admin", "network", "radvd", "prefix"}, cbi("radvd/prefix"), nil).leaf = true
	entry({"admin", "network", "radvd", "route"}, cbi("radvd/route"), nil).leaf = true
	entry({"admin", "network", "radvd", "rdnss"}, cbi("radvd/rdnss"), nil).leaf = true
	entry({"admin", "network", "radvd", "dnssl"}, cbi("radvd/dnssl"), nil).leaf = true
end
