--[[
LuCI - Lua Configuration Interface

Copyright 2010 John Crispin <blogic@openwrt.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

]]--

m = Map("telephony", translate("VoIP"))
m.on_after_commit = function() luci.sys.call("/etc/init.d/telephony restart") end

s = m:section(TypedSection, "account", translate("Account"), translate("Here You can specify the SIP account that you want to use."))
s.anonymous = true
s.addremove = true

s:option(Value, "realm", translate("Realm"))
s:option(Value, "username", translate("Username"))
s:option(Value, "password", translate("Password"))
s:option(Flag, "disabled", translate("Disabled"))

return m
