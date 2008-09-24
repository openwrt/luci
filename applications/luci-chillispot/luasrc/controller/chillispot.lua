--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--
module("luci.controller.chillispot", package.seeall)

function index()

	require("luci.i18n")
	local i18n = luci.i18n.translate

	entry( { "admin", "services", "chillispot" },            cbi("chillispot"),         i18n("chillispot",         "ChilliSpot"),                 90)
	entry( { "admin", "services", "chillispot", "network" }, cbi("chillispot_network"), i18n("chillispot_network", "Network Configuration"),      10)
	entry( { "admin", "services", "chillispot", "radius"  }, cbi("chillispot_radius"),  i18n("chillispot_radius",  "Radius Configuration"),       20)
	entry( { "admin", "services", "chillispot", "auth"    }, cbi("chillispot_auth"),    i18n("chillispot_auth",    "UAM and MAC Authentication"), 30)

end
