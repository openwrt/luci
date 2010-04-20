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

module("luci.controller.livestats", package.seeall)

function index()
	require("luci.i18n")
	luci.i18n.loadc("livestats")
	local i18n = luci.i18n.translate

	entry( {"admin", "status", "livestats"}, alias("admin", "status", "livestats", "wifistat"), i18n("Realtime Status"), 90 ).i18n = "livestats"
	entry( {"admin", "status", "livestats", "wifistat"}, template("livestats/wireless"),        i18n("Wireless"),        10 )
	entry( {"admin", "status", "livestats", "trafstat"}, template("livestats/traffic"),         i18n("Traffic"),         20 )
	entry( {"admin", "status", "livestats", "loadavg"},  template("livestats/loadavg"),         i18n("System Load"),     30 )
	
	entry( {"mini", "network", "wifistat"}, template("livestats/wireless"), i18n("Realtime Wireless Status"), 90 ).i18n = "livestats"
	entry( {"mini", "network", "trafstat"}, template("livestats/traffic"),  i18n("Realtime Traffic Status"),  91 ).i18n = "livestats"
	entry( {"mini", "system", "loadavg"},   template("livestats/loadavg"),  i18n("Realtime Load Status"),     92 ).i18n = "livestats"
end
