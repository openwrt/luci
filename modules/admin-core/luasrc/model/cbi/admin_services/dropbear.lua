--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--
m = Map("dropbear", "Dropbear SSHd", translate("a_srv_dropbear1", [[Der SSH-Server ermöglicht Shell-Zugriff
über das Netzwerk und bietet einen integrierten SCP-Dienst.]]))

s = m:section(TypedSection, "dropbear", "")
s.anonymous = true

port = s:option(Value, "Port", translate("port", "Port"))
port.isinteger = true

pwauth = s:option(Flag, "PasswordAuth", translate("a_srv_d_pwauth", "Passwortanmeldung"), translate("a_srv_d_pwauth1", "Erlaube Anmeldung per Passwort"))
pwauth.enabled = 'on'
pwauth.disabled = 'off'

return m