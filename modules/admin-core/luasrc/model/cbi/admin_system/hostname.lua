--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--
m = Map("system", translate("hostname", "Hostname"), translate("a_s_hostname1", [[Definiert den Hostnamen des Routers.
Der Hostname ist eine im Netzwerk eindeutige Kennung, die dieses Gerät identifiziert.]]))

s = m:section(TypedSection, "system", "")
s.anonymous = true

s:option(Value, "hostname", translate("hostname", "Hostname"))

return m