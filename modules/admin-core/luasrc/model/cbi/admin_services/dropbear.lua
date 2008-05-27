-- ToDo: Translate, Add descriptions
m = Map("dropbear", "SSH-Server", [[Der SSH-Server ermöglicht Shell-Zugriff
über das Netzwerk und bietet einen integrierten SCP-Dienst.]])

s = m:section(TypedSection, "dropbear")
s.anonymous = true

port = s:option(Value, "Port", "Port")
port.isinteger = true

pwauth = s:option(Flag, "PasswordAuth", "Passwortanmeldung", "Erlaube Anmeldung per Passwort")
pwauth.enabled = 'on'
pwauth.disabled = 'off'

return m