-- Licensed to the public under the Apache License 2.0.

m = Map("collectd",
	translate("UPS Plugin Configuration"),
	translate("The NUT plugin reads information about Uninterruptible Power Supplies."))

s = m:section(NamedSection, "nut", "plugin" )

enable = s:option(Flag, "enable", translate("Enable this plugin"))
enable.default = 0

host = s:option(Value, "UPS", translate("UPS"), translate("UPS name in NUT ups@host format"))
host.placeholder = "myupsname"
host.datatype = "string"
host.rmempty = true

return m
