--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--
m = Map("dropbear", "Dropbear SSHd", translate("a_srv_dropbear1"))

s = m:section(TypedSection, "dropbear", "")
s.anonymous = true

port = s:option(Value, "Port", translate("port"))
port.isinteger = true

pwauth = s:option(Flag, "PasswordAuth", translate("a_srv_d_pwauth"), translate("a_srv_d_pwauth1"))
pwauth.enabled = 'on'
pwauth.disabled = 'off'
pwauth.rmempty = false

return m
