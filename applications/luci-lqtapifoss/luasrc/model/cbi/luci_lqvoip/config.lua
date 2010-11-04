--[[
LuCI - Lua Configuration Interface

Copyright 2010 John Crispin <blogic@openwrt.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

]]--

m = Map("telephony", translate("VoIP"))

s = m:section(NamedSection, "config", "config", "Config", "Here You can specify the generic Configuration.")
m.on_after_commit = function() luci.sys.call("/etc/init.d/telephony restart") end

s:option(Value, "netdev", translate("Network"))

e = s:option(ListValue, "fw_dl", translate("Download firmware"))
e:value("0", translate("No"))
e:value("1", translate("Yes"))
e.default = "0"

e = s:option(Value, "fw_url", translate("Firmware path"))
e:depends("fw_dl", 1)

return m
