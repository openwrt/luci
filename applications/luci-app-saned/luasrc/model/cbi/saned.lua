-- Copyright 2015 Daniel Dickinson <openwrt@daniel.thecshore.com>
-- Licensed to the public under the Apache License 2.0.

local m, s, o

m = Map("saned", translate("saned"),
	translate("Configuration module for SANE Scanner Daemon"))

s = m:section(TypedSection, "saned", "SANE Daemon Configuration")
s.addremove = false
s.anonymous = true

o = s:option(Flag, "enabled", translate("Enable:"))
o.rmempty = false

function o.cfgvalue(self, section)
	return luci.sys.init.enabled("saned") and self.enabled or self.disabled
end

function o.write(self, section, value)
	if value == "1" then
		luci.sys.init.enable("saned")
		luci.sys.call("/etc/init.d/saned start >/dev/null")
	else
		luci.sys.call("/etc/init.d/saned stop >/dev/null")
		luci.sys.init.disable("saned")
	end

	return Flag.write(self, section, value)
end

o = s:option(DynamicList, "acl", translate("Allow networks (CIDR)"))
o.datatype = "ipaddr"

o = s:option(Value, "portrange", translate("Data portrange"))
o.default = "10000-10100"
o.datatype = "portrange"

return m
