--[[
LuCI model for mosquitto MQTT broker configuration management
Copyright eTactica ehf, 2018

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

]]--

local datatypes = require("luci.cbi.datatypes")
local _ = luci.i18n.translate

--- Like a Flag, but with an option to remove/set to default.
local function OptionalFlag(section, key, title, description)
    local o = section:option(ListValue, key, title, description)
    o.optional = true
    o:value("", "Default")
    o:value("1", "Enabled")
    o:value("0", "Disabled")
    return o
end

m = Map("mosquitto", _("Mosquitto MQTT Broker"),
    _([[mosquitto - the <a href='http://www.mosquitto.org'>blood thirsty</a>
MQTT messaging broker.  Note, only some of the available configuration files
 are supported at this stage, use the checkbox below to use config generated
 by this page, or the stock mosquitto configuration file in 
 /etc/mosquitto/mosquitto.conf]]))
 
s = m:section(TypedSection, "owrt", "OpenWRT")
s.anonymous = true
p = s:option(Flag, "use_uci", _("Use this LuCI configuration page"),
	_([[If checked, mosquitto runs with a config generated
	from this page. (Or from UCI directly)  If unchecked, mosquitto
        runs with the config in /etc/mosquitto/mosquitto.conf
        (and this page is ignored)]]))

s = m:section(TypedSection, "mosquitto", "Mosquitto")
s.anonymous = true

p = s:option(MultiValue, "log_dest", _("Log destination"),
    _("You can have multiple, but 'none' will override all others"))
p:value("stderr", "stderr")
p:value("stdout", "stdout")
p:value("syslog", "syslog")
p:value("topic", "$SYS/broker/log/[severity]")
p:value("none", "none")

OptionalFlag(s, "no_remote_access", _("Disallow remote access to this broker"),
    _([[Outbound bridges will still work, but this will make the primary listener
    only available from localhost]]))

local o
o = s:option(Value, "sys_interval", _("Time in seconds between updates of the $SYS tree"), _("Set to zero to disable"))
o.datatype = "uinteger"
o.optional = true

OptionalFlag(s, "allow_anonymous", _("Allow anonymous connections"), _("Allow to connect without providing a username and password"))
o = s:option(Value, "max_inflight_messages", _("Max Inflight Messages"), _("Limit for message allowed inflight"))
o.datatype = "uinteger"
o.optional = true
o = s:option(Value, "max_queued_messages", _("Max Queued Messages"), _("Limit for message queue when offline"))
o.datatype = "uinteger"
o.optional = true
o = s:option(Value, "max_queued_bytes", _("Max Queued bytes"), _("Limit for message queue when offline, zero to disable)"))
o.datatype = "uinteger"
o.optional = true


s = m:section(TypedSection, "persistence", _("Persistence"))
s.anonymous = true
s.addremove = false
s:option(Flag, "persistence", _("Persistence enabled"), _("Should persistence to disk be enabled at all")).rmempty = false
o = s:option(Value, "client_expiration", _("Client expiration"), _("Remove persistent clients if they haven't reconnected in this period, eg 6h, 3d, 2w"))
o.optional = true
o:depends("persistence", true)
o = OptionalFlag(s, "autosave_on_changes", _("Autosave on changes"), _("Autosave interval applies to change counts instead of time"))
o:depends("persistence", true)
o = s:option(Value, "autosave_interval", _("Autosave interval"), _("Save persistence file after this many seconds or changes"))
o.optional = true
o:depends("persistence", true)
o = s:option(Value, "file", _("Persistent file name"))
o.optional = true
o:depends("persistence", true)
o = s:option(Value, "location", _("Persistent file path (with trailing/)"), _("Path to persistent file"))
o.optional = true
o:depends("persistence", true)

s = m:section(TypedSection, "listener", _("Listeners"), _("You can configure additional listeners here"))
s.addremove = true
s.anonymous = true
s:option(Value, "port", _("Port")).datatype = "port"

o = s:option(ListValue, "protocol", _("Protocol to use when listening"))
o:value("", "Default")
o:value("mqtt", _("MQTT"))
o:value("websockets", _("WebSockets"))

s:option(Value, "http_dir", _("http_dir to serve on websockets listeners")).optional = true
OptionalFlag(s, "use_username_as_clientid", "use_username_as_clientid")
o = s:option(Value, "cafile", _("CA file path"))
o.optional = true
o.datatype = "file"
o = s:option(Value, "capath", _("CA path to search"))
o.optional = true
o.datatype = "directory"
o = s:option(Value, "certfile", _("server certificate file (PEM encoded)"))
o.optional = true
o.datatype = "file"
o = s:option(Value, "keyfile", _("keyfile (PEM encoded)"))
o.optional = true
o.datatype = "file"

o = s:option(ListValue, "tls_version", _("TLS Version"),
    _("Depends on your openssl version, empty to support all"))
o.optional = true
o:value("", "Default")
o:value("tlsv1.1")
o:value("tlsv1.2")
o:value("tlsv1.3")

OptionalFlag(s, "require_certificate", _("Require clients to present a certificate"))
OptionalFlag(s, "use_identity_as_username", "use_identity_as_username")
s:option(Value, "crlfile", _("CRL to use if require_certificate is enabled")).optional = true
s:option(Value, "ciphers", _("Ciphers control. Should match 'openssl ciphers' format")).optional = true
s:option(Value, "psk_hint", _("PSK Hint to provide to connecting clients")).optional = true

-- we want to allow multiple bridge sections
s = m:section(TypedSection, "bridge", _("Bridges"),
    _("You can configure multiple bridge connections here"))
s.anonymous = true
s.addremove = true

conn = s:option(Value, "connection", _("Connection name"),
    _("unique name for this bridge configuration"))

local function validate_address(self, value)
    local host, port = unpack(luci.util.split(value, ":"))
    if (datatypes.host(host)) then
        if port and #port then
            if not datatypes.port(port) then
                return nil, _("Please enter a valid port after the :")
            end
        end
        return value
    end
    return nil, _("Please enter a hostname or an IP address")
end

addr = s:option(Value, "address", _("address"), _("address[:port] of remote broker"))
addr.datatype = "string"
addr.validate = validate_address

-- TODO - make the in/out/both a dropdown/radio or something....
topics = s:option(DynamicList, "topic", _("topic"),
    _("full topic string for mosquitto.conf, eg: 'power/# out 2'"))

OptionalFlag(s, "cleansession", _("Clean session"))
OptionalFlag(s, "notifications", _("notifications"),
    _("Attempt to notify the local and remote broker of connection status, defaults to $SYS/broker/connections/&lt;clientid&gt;/state"))
s:option(Value, "notification_topic", _("Topic to use for local+remote remote for notifications.")).optional = true
OptionalFlag(s, "notifications_local_only", _("Notifications local only"), _("Bridge connection states should only be published locally"))

s:option(Value, "remote_clientid", _("Client id to use on remote end of this bridge connection")).optional = true
s:option(Value, "local_clientid", _("Client id to use locally. Important when bridging to yourself")).optional = true
o = s:option(Value, "keepalive_interval", _("Keepalive interval for this bridge"))
o.datatype = "uinteger"
o.optional = true
o = s:option(ListValue, "start_type", _("How should this bridge be started"))
o.optional = true
o:value("", "Default")
o:value("automatic", _("Automatic, includes restarts"))
o:value("lazy", _("Automatic, but stopped when not used"))
o:value("once", _("Automatic, but no restarts"))
o = s:option(Value, "restart_timeout", _("How long to wait before reconnecting"))
o.datatype = "uinteger"
o.optional = true
o = s:option(Value, "idle_timeout", _("How long to wait before disconnecting"))
o.datatype = "uinteger"
o.optional = true
o = s:option(Value, "threshold", _("How many messages to queue before restarting lazy bridge"))
o.datatype = "uinteger"
o.optional = true

OptionalFlag(s, "try_private", "try_private",
    _("attempt to notify the remote broker that this is a bridge, not all brokers support this."))
s:option(Value, "remote_username", _("Remote username")).optional = true
o = s:option(Value, "remote_password", _("Remote password"))
o.optional = true
o.password = true

s:option(Value, "identity", _("PSK Bridge Identity"), _("Identity for TLS-PSK")).optional = true

-- no hex validation available in datatypes
local function validate_psk_key(self, value)
    if (value:match("^[a-fA-F0-9]+$")) then
        return value
    end
    return nil, _("Only hex numbers are allowed (use A-F characters and 0-9 digits)")
end

psk_key = s:option(Value, "psk", _("Bridge PSK"), _("Key for TLS-PSK"))
psk_key.password = true
psk_key.optional = true
psk_key.datatype = "string"
psk_key.validate = validate_psk_key

b_tls_version = s:option(ListValue, "tls_version", _("TLS Version"),
    _("The remote broker must support the same version of TLS for the connection to succeed."))
b_tls_version:value("", "Default")
b_tls_version:value("tlsv1.1")
b_tls_version:value("tlsv1.2")
b_tls_version:value("tlsv1.3")
b_tls_version.optional = true

o = s:option(Value, "cafile", _("Path to CA file"))
o.optional = true
o.datatype = "file"
o = s:option(Value, "capath", _("Directory to search for CA files"))
o.optional = true
o.datatype = "directory"
o = s:option(Value, "certfile", _("Path to PEM encoded server certificate file"))
o.optional = true
o.datatype = "file"
o = s:option(Value, "keyfile", _("Path to PEM encoded keyfile"))
o.optional = true
o.datatype = "file"

return m
