--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--
m = Map("httpd", "Busybox HTTPd", translate("a_srv_http1", "Ein kleiner Webserver, der für die Bereitstellung von LuCI genutzt werden kann."))

s = m:section(TypedSection, "httpd", "")
s.anonymous = true

port = s:option(Value, "port", translate("port", "Port"))
port.isinteger = true

s:option(Value, "home", translate("a_srv_http_root", "Wurzelverzeichnis"))

config = s:option(Value, "c_file", translate("configfile", "Konfigurationsdatei"), translate("a_srv_http_config1", "/etc/httpd.conf wenn leer"))
config.rmempty = true

realm = s:option(Value, "realm", translate("a_srv_http_authrealm", "Anmeldeaufforderung"), translate("a_srv_http_authrealm1", "Aufforderungstext zum Anmelden im Administrationsbereich"))
realm.rmempty = true

return m