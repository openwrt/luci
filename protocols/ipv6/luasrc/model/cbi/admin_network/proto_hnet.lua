--[[
LuCI - Lua Configuration Interface

Copyright 2013 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0
]]--

local map, section, net = ...

section:taboption("general", Flag, "guest", translate("Guest mode"))
section:taboption("advanced", Flag, "adhoc", translate("Ad-hoc mode"))

local plen = section:taboption("advanced", Value, "ip6_plen", translate("IPv6 assignment length"),
	translate("Assign a part of given length of every public IPv6-prefix to this interface"))
plen.datatype = "max(128)"
plen.default = "64"

section:taboption("advanced", Value, "link_id", translate("IPv6 assignment hint"),
	translate("Assign prefix parts using this hexadecimal subprefix ID for this interface."))

luci.tools.proto.opt_macaddr(section, ifc, translate("Override MAC address"))

o = section:taboption("advanced", Value, "mtu", translate("Override MTU"))
o.placeholder = "1500"
o.datatype    = "max(9200)"
