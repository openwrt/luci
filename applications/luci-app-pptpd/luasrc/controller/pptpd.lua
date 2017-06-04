--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>
Copyright 2014 HackPascal <hackpascal@gmail.com>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--

module("luci.controller.pptpd", package.seeall)

function index()
	if not nixio.fs.access("/etc/config/pptpd") then
		return
	end

	entry({"admin", "services", "pptpd"},
		alias("admin", "services", "pptpd", "settings"),
		_("VPN Server"), 60)

	entry({"admin", "services", "pptpd", "settings"},
		cbi("pptpd/settings"),
		_("General Settings"), 10).leaf = true

	entry({"admin", "services", "pptpd", "users"},
		cbi("pptpd/users"),
		_("Users Manager"), 20).leaf = true

	entry({"admin", "services", "pptpd", "online"},
		cbi("pptpd/online"),
		_("Online Users"), 30).leaf = true
end
