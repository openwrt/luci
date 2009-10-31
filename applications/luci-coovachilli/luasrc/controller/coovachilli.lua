--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--
module("luci.controller.coovachilli", package.seeall)

function index()

	require("luci.i18n")
	local i18n = luci.i18n.translate

	local cc = entry( { "admin", "services", "coovachilli" },            cbi("coovachilli"),         i18n("CoovaChilli"),                90)
	cc.i18n = "coovachilli"
	cc.subindex = true
	
	entry( { "admin", "services", "coovachilli", "network" }, cbi("coovachilli_network"), i18n("Network Configuration"),      10)
	entry( { "admin", "services", "coovachilli", "radius"  }, cbi("coovachilli_radius"),  i18n("RADIUS configuration"),       20)
	entry( { "admin", "services", "coovachilli", "auth"    }, cbi("coovachilli_auth"),    i18n("UAM and MAC Authentication"), 30)

end
