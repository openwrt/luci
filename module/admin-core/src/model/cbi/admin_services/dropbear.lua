-- ToDo: Translate, Add descriptions
m = Map("dropbear", "SSH-Server")

s = m:section(TypedSection, "dropbear")
s.anonymous = true

port = s:option(Value, "Port", "Port")
port.isinteger = true

pwauth = s:option(Flag, "PasswordAuth", "Passwortanmeldung")
pwauth.enabled = 'on'
pwauth.disabled = 'off'

return m