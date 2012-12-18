--[[
LuCI - Lua Configuration Interface

Copyright © 2011 Manuel Munz <freifunk at somakoma dot de>
Copyright © 2012 David Woodhouse <dwmw2@infradead.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0
]]--

m = Map("luci_statistics",
	translate("UPS Plugin Configuration"),
	translate("The NUT plugin reads information about Uninterruptible Power Supplies."))

s = m:section(NamedSection, "collectd_nut", "luci_statistics" )

enable = s:option(Flag, "enable", translate("Enable this plugin"))
enable.default = 0

host = s:option(Value, "UPS", translate("UPS"), translate("UPS name in NUT ups@host format"))
host.placeholder = "myupsname"
host.datatype = "string"
host.rmempty = true

return m
