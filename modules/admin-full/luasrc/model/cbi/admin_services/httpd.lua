--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--
m = Map("httpd", "Busybox HTTPd", translate("A small webserver which can be used to serve <abbr title=\"Lua Configuration Interface\">LuCI</abbr>."))

s = m:section(TypedSection, "httpd", "")
s.anonymous = true
s.addremove = true

port = s:option(Value, "port", translate("Port"))
port.isinteger = true

s:option(Value, "home", translate("Document root"))

config = s:option(Value, "c_file", translate("Configuration file"), translate("defaults to <code>/etc/httpd.conf</code>"))
config.rmempty = true

realm = s:option(Value, "realm", translate("Authentication Realm"), translate("The realm which will be displayed at the authentication prompt for protected pages."))
realm.rmempty = true

return m
