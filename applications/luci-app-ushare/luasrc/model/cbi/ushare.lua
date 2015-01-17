-- Copyright 2008 Yanira <forum-2008@email.de>
-- Licensed to the public under the Apache License 2.0.

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
