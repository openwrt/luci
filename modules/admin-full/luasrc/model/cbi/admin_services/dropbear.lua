--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--
m = Map("dropbear", "Dropbear SSHd", translate("Dropbear offers <abbr title=\"Secure Shell\">SSH</abbr> network shell access and an integrated <abbr title=\"Secure Copy\">SCP</abbr> server"))

s = m:section(TypedSection, "dropbear", "")
s.anonymous = true

port = s:option(Value, "Port", translate("Port"))
port.isinteger = true

pwauth = s:option(Flag, "PasswordAuth", translate("Password authentication"), translate("Allow <abbr title=\"Secure Shell\">SSH</abbr> password authentication"))
pwauth.enabled = 'on'
pwauth.disabled = 'off'
pwauth.rmempty = false

return m
