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
m = Map("lucittpd", "LuCIttpd", translate("A lightweight HTTP/1.1 webserver written in C and Lua designed to serve LuCI"))

s = m:section(NamedSection, "lucittpd", "lucittpd", "")

s:option(Value, "port", translate("Port"))
s:option(Value, "root", translate("Document root"))
s:option(Value, "path", translate("Plugin path"))
s:option(Flag, "keepalive", translate("Enable Keep-Alive"))
s:option(Value, "timeout", translate("Connection timeout"))

return m
