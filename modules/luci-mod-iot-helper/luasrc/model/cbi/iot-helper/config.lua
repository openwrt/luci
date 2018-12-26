-- Copyright 2018 TJ Kolev (tjkolev@gmail.com)
-- This is free software, licensed under the Apache License, Version 2.0

m = Map("iot-helper", "IoT Helper API Config", "Configuration for the utility API to support IoT devces.")
m.tabbed = true

secSmtp = m:section(NamedSection, "general", "general", "General", "Configuration for the IoT helper API. For documentation please see <a href=https://github.com/openwrt/luci/blob/master/applications/luci-app-iot/README.md>the readme on the GitHub page.</a>.")
secSmtp.addremove = false
secSmtp.anonymous = true
secSmtp:option(Value, "defaultdevice", "Default Device Config", "Device configuration when no device matches API request.")
secSmtp:option(Value, "defaultevent", "Default Event Config", "Event configuration when no event matches API request.")

secSmtp = m:section(NamedSection, "smtp", "smtp", "SMTP Server", "SMTP server for sending email notifications on events from the IoT devices.")
secSmtp.addremove = false
secSmtp.anonymous = true
secSmtp:option(Value, "server", "Server", "SMTP server.")
secSmtp:option(Value, "port", "Port", "The port on the SMTP server to use.")
secSmtp:option(Value, "user", "User", "User name for authentication.")
secSmtp:option(Value, "password", "Pasword", "User password.")
secSmtp:option(Value, "from", "From", "From email address.")
secSmtp:option(Flag, "secure", "Secure", "Use secure transfer (SSL).")

secDev = m:section(TypedSection, "device", "Device Config", "Configuration per device ID. The device ID will be passed as a query parameter on the IoT API.")
secDev.addremove = true
secDev.anonymous = false
function secDev.validate(self, sectionid)
    return string.lower(sectionid)
end
secDev:option(Value, "comment", "Comment")
secDev:option(TextValue, "config", "Configuration", "Text in a format the device can understand.")


secEvent = m:section(TypedSection, "event", "Event Config", "Configuration per event ID. The event ID will be passed as a query parameter on the IoT API.")
secEvent.addremove = true
secEvent.anonymous = false
function secEvent.validate(self, sectionid)
    return string.lower(sectionid)
end
secEvent:option(Value, "recipients", "Recipients", "Comma separated list of email addresses to notify.")
secEvent:option(Value, "subject", "Subject", "Subject of the notification email.")
secEvent:option(TextValue, "msg", "Message", "Notification message. Any device message will be appended to this one.")

return m
