--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>
Copyright 2008 Jo-Philipp Wich <xm@leipzig.freifunk.net>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--
m = Map("tinyproxy", translate("tinyproxy"), translate("tinyproxy_desc"))

s = m:section(TypedSection, "tinyproxy", translate("general"))
s.anonymous = true

s:option(Flag, "enable", translate("enable"))

s:option(Value, "Port", translate("port"))
s:option(Value, "Listen").optional = true
s:option(Value, "Bind").optional = true
s:option(Value, "Timeout").optional = true

s:option(Value, "DefaultErrorFile").optional = true
s:option(Value, "StatFile").optional = true

s:option(Flag, "Syslog").optional = true
f = s:option(Value, "Logfile")
f.optional = true

l = s:option(ListValue, "LogLevel")
l.optional = true
l:value("Critical")
l:value("Error")
l:value("Warning")
l:value("Notice")
l:value("Connect")
l:value("Info")

s:option(DynamicList, "XTinyproxy").optional = true

s:option(DynamicList, "Allow")
s:option(Value, "ViaProxyName")

s:option(FileUpload, "Filter")
s:option(Flag, "FilterURLs")
s:option(Flag, "FilterExtended")
s:option(Flag, "FilterCaseSensitive")
s:option(Flag, "FilterDefaultDeny")

s:option(DynamicList, "Anonymous")
s:option(DynamicList, "ConnectPort")

s:option(Value, "User").optional = true
s:option(Value, "Group").optional = true
s:option(Value, "MaxClients").optional = true
s:option(Value, "MinSpareServers").optional = true
s:option(Value, "MaxSpareServers").optional = true
s:option(Value, "StartServers").optional = true
s:option(Value, "MaxRequestsPerChild").optional = true


s = m:section(TypedSection, "upstream")
s.anonymous = true
s.addremove = true

t = s:option(ListValue, "type")
t:value("proxy", translate("tinyproxy_type_proxy"))
t:value("reject", translate("tinyproxy_type_reject"))

ta = s:option(Value, "target")
ta.rmempty = true

v = s:option(Value, "via")
v:depends({type="proxy"})

return m