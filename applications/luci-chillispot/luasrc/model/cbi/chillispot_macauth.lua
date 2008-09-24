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

s1:option( Flag, "uamanyip" )
s1:option( Flag, "uamanydns" )
s1:option( Flag, "dnsparanoia" )
s1:option( Flag, "nouamsuccess" )
s1:option( Flag, "nouamwispr" )
s1:option( Flag, "usestatusfile" )
s1:option( Flag, "chillixml" )

s1:option( Value, "uamhomepage" ).optional = true
s1:option( Value, "uamlisten" ).optional = true
s1:option( Value, "uamport" ).optional = true
s1:option( Value, "uamiport" ).optional = true
s1:option( Value, "uamdomain" ).optional = true
s1:option( Value, "uamlogoutip" ).optional = true
s1:option( DynamicList, "uamallowed" ).optional = true
s1:option( Value, "uamui" ).optional = true

s1:option( Value, "wisprlogin" ).optional = true

s1:option( Value, "defsessiontimeout" ).optional = true
s1:option( Value, "defidletimeout" ).optional = true
s1:option( Value, "definteriminterval" ).optional = true

s1:option( Value, "ssid" ).optional = true
s1:option( Value, "vlan" ).optional = true
s1:option( Value, "nasip" ).optional = true
s1:option( Value, "nasmac" ).optional = true
s1:option( Value, "wwwdir" ).optional = true
s1:option( Value, "wwwbin" ).optional = true

s:option( Value, "localusers" ).optional = true
s:option( Value, "postauthproxy" ).optional = true
s:option( Value, "postauthproxyport" ).optional = true
s:option( Value, "locationname" ).optional = true


-- mac authentication
s = m:section(TypedSection, "macauth")
s.anonymous = true

s:option( Flag, "macauth" )
s:option( Flag, "macallowlocal" )
s:option( DynamicList, "macallowed" )

pw = s:option( Value, "macpasswd" )
pw.optional = true
pw.password = true

s:option( Value, "macsuffix" ).optional = true

return m
