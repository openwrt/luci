-- ToDo: Translate, Add descriptions
m = Map("httpd", "HTTP-Server", "Der HTTP-Server ist u.a. für die Bereitstellung dieser Obefläche zuständig.")

s = m:section(TypedSection, "httpd")
s.anonymous = true

port = s:option(Value, "port", "Port")
port.isinteger = true

s:option(Value, "home", "Wurzelverzeichnis")

config = s:option(Value, "c_file", "Konfigurationsdatei", "/etc/httpd.conf wenn leer")
config.rmempty = true

realm = s:option(Value, "realm", "Anmeldeaufforderung", "Aufforderungstext zum Anmelden im Administrationsbereich")
realm.rmempty = true

return m