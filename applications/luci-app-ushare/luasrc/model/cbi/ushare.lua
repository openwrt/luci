--[[

LuCI uShare
(c) 2008 Yanira <forum-2008@email.de>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

$Id$

]]--

m = Map("ushare", translate("uShare"),
	luci.util.pcdata(translate("uShare is a UPnP (TM) A/V & DLNA Media Server. It implements the server component that provides UPnP media devices with information on available multimedia files.")))

s = m:section(TypedSection, "ushare", translate("Settings"))
s.addremove = false
s.anonymous = true

s:option(Flag, "enabled", translate("Enable"))

s:option(Value, "username", translate("Username"))

s:option(Value, "servername", translate("Servername"))

dif = s:option( Value, "interface", translate("Interface")) 
for _, nif in ipairs(luci.sys.net.devices()) do                         
        if nif ~= "lo" then dif:value(nif) end                          
end 

s:option(DynamicList, "content_directories", translate("Content directories"))

s:option(Flag, "disable_webif", translate("Disable webinterface"))

s:option(Flag, "disable_telnet", translate("Disable telnet console"))

s:option(Value, "options", translate("Options"))

return m
