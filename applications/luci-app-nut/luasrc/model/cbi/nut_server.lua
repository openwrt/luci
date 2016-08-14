-- Copyright 2015 Daniel Dickinson <openwrt@daniel.thecshore.com>
-- Licensed to the public under the Apache License 2.0.

local m, s, o

local nixio = require "nixio"
require "luci.util"

m = Map("nut_server", translate("Network UPS Tools (Server)"),
	translate("Network UPS Tools Server Configuration"))

s = m:section(TypedSection, "driver", translate("Driver Configuration"))
s.addremove = true
s.anonymous = false

driverlist = nixio.fs.dir("/lib/nut")

o = s:option(ListValue, "driver", translate("Driver"))
for driver in driverlist do
	o:value(driver)
end
o.optional = false

o = s:option(Value, "port", translate("Port"))
o.optional = false
o.placeholder = 3493

function o.validate(self, value)
	if luci.cbi.datatypes.port(value) then
		return value
	end
	if value == "auto" then	
		return valu
	end
	return nil
end

o = s:option(Value, "other", translate("Additional Parameters"))
o.optional = true

s = m:section(TypedSection, "user", translate("NUT Users"))
s.addremove = true
s.anonymous = true

o = s:option(Value, "username", translate("Username"))
o.optional = false

o = s:option(Value, "password", translate("Password"))
o.password = true
o.optional = false

o = s:option(ListValue, "action", translate("Allowed actions"))
o:value(translate("Set variables"), "set")
o:value(translate("Forced Shutdown"), "fsd")
o.optional = true

o = s:option(DynamicList, "instcmds", translate("Instant commands"), translate("Use upscmd -l to see full list which the commands you UPS supports (requires upscmd package)"))
o.optional = true

o = s:option(ListValue, "upsmon", translate("Role"))
o:value(translate("Slave"), "slave")
o:value(translate("Master"), "master")
o.optional = false

s = m:section(TypedSection, "listen_address", translate("Addresses on which to listen"))
s.addremove = true
s.anonymous = true

o = s:option(Value, "address", translate("IP Address"))
o.optional = false
o.datatype = "ipaddr"

o = s:option(Value, "port", translate("Port"))
o.optional = true
o.datatype = "port"

s = m:section(NamedSection, "upsd", "upsd", translate("Global Settings"))
s.addremove = true

o = s:option(Value, "maxage", translate("Maximum Age of Data"), translate("Period after which data is considered stale"))
o.datatype = "uinteger"
o.optional = true
o.placeholder = 15

o = s:option(Value, "statepath", translate("Path to state file"))
o.optional = true
o.placeholder = "/var/run/nut"

o = s:option(Value, "maxconn", translate("Maximum connections"))
o.optional = true
o.datatype = "uinteger"
o.placeholder = 24

if luci.util.checklib("/usr/sbin/upsd", "libssl.so") then
	o = s:option(Value, "certfile", translate("Certificate file (SSL)"))
	o.optional = true
end

o = s:option(Value, "runas", translate("RunAs User"), translate("User as which to execute upsd and driver; requires device file accessed by driver be read-write for that user."))
o.optional = true

return m
