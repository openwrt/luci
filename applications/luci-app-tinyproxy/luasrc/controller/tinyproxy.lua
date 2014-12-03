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

module("luci.controller.tinyproxy", package.seeall)

function index()
	if not nixio.fs.access("/etc/config/tinyproxy") then
		return
	end

	entry({"admin", "services", "tinyproxy"}, alias("admin", "services", "tinyproxy", "config"), _("Tinyproxy"))
	entry({"admin", "services", "tinyproxy", "status"}, template("tinyproxy_status"), _("Status"))
	entry({"admin", "services", "tinyproxy", "config"}, cbi("tinyproxy"), _("Configuration"))
end
