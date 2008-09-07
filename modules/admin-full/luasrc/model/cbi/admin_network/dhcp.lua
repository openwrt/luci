--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--
require("luci.tools.webadmin")
require("luci.model.uci")
require("luci.util")

m = Map("dhcp", "DHCP")

s = m:section(TypedSection, "dhcp", "")
s.addremove = true
s.anonymous = true

iface = s:option(ListValue, "interface", translate("interface"))
luci.tools.webadmin.cbi_add_networks(iface)

local uci = luci.model.uci.cursor()
uci:foreach("network", "interface",
	function (section)
		if section[".name"] ~= "loopback" then
			iface.default = iface.default or section[".name"]
			s:depends("interface", section[".name"])
		end
	end)

uci:foreach("network", "alias",
	function (section)
		iface:value(section[".name"])
		s:depends("interface", section[".name"])
	end)

s:option(Value, "start", translate("start")).rmempty = true

s:option(Value, "limit", translate("limit")).rmempty = true

s:option(Value, "leasetime").rmempty = true

s:option(Flag, "dynamicdhcp").rmempty = true

s:option(Value, "name", translate("name")).optional = true

ignore = s:option(Flag, "ignore")
ignore.optional = true

s:option(Value, "netmask", translate("netmask")).optional = true

s:option(Flag, "force").optional = true

s:option(DynamicList, "dhcp_option").optional = true


for i, n in ipairs(s.children) do
	if n ~= iface and n ~= ignore then
		n:depends("ignore", "")
	end
end

return m