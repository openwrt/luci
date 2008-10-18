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

	entry( {"admin", "status", "wifistat"}, template("livestats/wireless"), luci.i18n.translate("livestat_wireless", "Live Wireless Statistics") ).i18n = "livestat"
	entry( {"admin", "status", "trafstat"}, template("livestats/traffic"),  luci.i18n.translate("livestat_traffic",  "Live Traffic Statistics")  ).i18n = "livestat"
	entry( {"admin", "status", "loadavg"},  template("livestats/loadavg"),  luci.i18n.translate("livestat_loadavg",  "Live Load Statistics")     ).i18n = "livestat"
end
