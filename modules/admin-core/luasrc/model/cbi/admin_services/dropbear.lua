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