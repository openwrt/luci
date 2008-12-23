--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--
m = Map("freifunk", "Freifunk")

c = m:section(NamedSection, "community", "public", "Gemeinschaft", [[Dies sind die Grundeinstellungen
für die lokale Freifunkgemeinschaft. Diese Werte wirken sich NICHT auf die Konfiguration
des Routers aus, sondern definieren nur die Vorgaben für den Freifunkassistenten.]])
c:option(Value, "name", "Gemeinschaft")
c:option(Value, "homepage", "Webseite")
c:option(Value, "ssid", "ESSID")
c:option(Value, "prefix", "Netzprefix")

return m