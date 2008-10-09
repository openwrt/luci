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
module("luci.controller.openvpn", package.seeall)

function index()
	require("luci.i18n")
	luci.i18n.loadc("openvpn")

	entry( {"admin", "services", "openvpn"}, cbi("openvpn"), luci.i18n.translate("openvpn", "OpenVPN") ).i18n = "openvpn"
	entry( {"admin", "services", "openvpn", "basic"},    cbi("openvpn-basic"),    nil ).leaf = true
	entry( {"admin", "services", "openvpn", "advanced"}, cbi("openvpn-advanced"), nil ).leaf = true
end
