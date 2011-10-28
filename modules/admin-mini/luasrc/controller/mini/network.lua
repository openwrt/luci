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

module("luci.controller.mini.network", package.seeall)

function index()
	entry({"mini", "network"}, alias("mini", "network", "index"), _("Network"), 20).index = true
	entry({"mini", "network", "index"}, cbi("mini/network", {autoapply=true}), _("General"), 1)
	entry({"mini", "network", "wifi"}, cbi("mini/wifi", {autoapply=true}), _("Wifi"), 10)
	entry({"mini", "network", "dhcp"}, cbi("mini/dhcp", {autoapply=true}), _("DHCP"), 20)
end
