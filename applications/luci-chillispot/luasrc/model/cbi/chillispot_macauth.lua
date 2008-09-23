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


m = Map("chillispot")


-- mac authentication
s = m:section(TypedSection, "macauth")
s.anonymous = true

s:option( Flag, "macauth" )
s:option( DynamicList, "macallowed" )
s:option( Value, "macpasswd" ).optional = true
s:option( Value, "macsuffix" ).optional = true


return m
