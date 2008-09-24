--[[

LuCI uShare
(c) 2008 Yanira <forum-2008@email.de>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

$Id$

]]--

m = Map("ushare", translate("ushare"),
	translate("ushare_desc"))

s = m:section(TypedSection, "ushare", translate("settings"))
s.addremove = false
s.anonymous = true

s:option(Flag, "enabled", translate("enabled", "Enable"))

s:option(Value, "username", translate("username"))

s:option(Value, "servername", translate("servername"))

dif = s:option( Value, "interface", translate("interface")) 
for _, nif in ipairs(luci.sys.net.devices()) do                         
        if nif ~= "lo" then dif:value(nif) end                          
end 

s:option(Value, "content_directories", translate("content_directories"))

s:option(Flag, "disable_webif", translate("disable_webif"))

s:option(Flag, "disable_telnet", translate("disable_telnet"))

s:option(Value, "options", translate("options"))

return m
