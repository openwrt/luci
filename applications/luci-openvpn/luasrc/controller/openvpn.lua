--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>
Copyright 2008 Jo-Philipp Wich <xm@leipzig.freifunk.net>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id: init.lua 3516 2008-10-04 18:42:06Z jow $
]]--
module("luci.controller.openvpn", package.seeall)

function index()
	require("luci.i18n")
	luci.i18n.loadc("openvpn")

	local p = entry(
		{"admin", "services", "openvpn"}, cbi("openvpn"),
		luci.i18n.translate("openvpn", "OpenVPN")
	)

	p.i18n = "openvpn"
	p.leaf = true
end
