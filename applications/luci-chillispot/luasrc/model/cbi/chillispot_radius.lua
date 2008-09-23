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


-- uam config
s1 = m:section(TypedSection, "uam")
s1.anonymous = true

s1:option( Value, "uamserver" )
s1:option( Value, "uamsecret" ).password = true
s1:option( Flag, "uamanydns" )
s1:option( Value, "uamhomepage" ).optional = true
s1:option( Value, "uamlisten" ).optional = true
s1:option( Value, "uamport" ).optional = true
s1:option( DynamicList, "uamallowed" ).optional = true


-- radius server
s2 = m:section(TypedSection, "radius")
s2.anonymous = true

s2:option( Value, "radiusserver1" )
s2:option( Value, "radiusserver2" )
s2:option( Value, "radiussecret" ).password = true

s2:option( Value, "radiuslisten" ).optional = true
s2:option( Value, "radiusauthport" ).optional = true
s2:option( Value, "radiusacctport" ).optional = true

s2:option( Value, "radiusnasid" ).optional = true
s2:option( Value, "radiusnasip" ).optional = true

s2:option( Value, "radiuscalled" ).optional = true
s2:option( Value, "radiuslocationid" ).optional = true
s2:option( Value, "radiuslocationname" ).optional = true


-- radius proxy
s3 = m:section(TypedSection, "proxy")
s3.anonymous = true

s3:option( Value, "proxylisten" ).optional = true
s3:option( Value, "proxyport" ).optional = true
s3:option( Value, "proxyclient" ).optional = true
ps = s3:option( Value, "proxysecret" )
ps.optional = true
ps.password = true

return m
