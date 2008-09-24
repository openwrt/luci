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


m = Map("coovachilli")

-- general
s1 = m:section(TypedSection, "general")
s1.anonymous = true

s1:option( Flag, "debug" )
s1:option( Value, "interval" )
s1:option( Value, "pidfile" ).optional = true
s1:option( Value, "statedir" ).optional = true
s1:option( Value, "cmdsock" ).optional = true
s1:option( Value, "logfacility" ).optional = true

-- remote config management
s2 = m:section(TypedSection, "remoteconfig")
s2.anonymous = true

s2:option( Value, "confusername" )
s2:option( Value, "confpassword" )


return m
