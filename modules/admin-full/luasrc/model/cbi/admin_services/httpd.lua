--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--
m = Map("httpd", "Busybox HTTPd", translate("a_srv_http1"))

s = m:section(TypedSection, "httpd", "")
s.anonymous = true
s.addremove = true

port = s:option(Value, "port", translate("port"))
port.isinteger = true

s:option(Value, "home", translate("a_srv_http_root"))

config = s:option(Value, "c_file", translate("configfile"), translate("a_srv_http_config1"))
config.rmempty = true

realm = s:option(Value, "realm", translate("a_srv_http_authrealm"), translate("a_srv_http_authrealm1"))
realm.rmempty = true

return m
