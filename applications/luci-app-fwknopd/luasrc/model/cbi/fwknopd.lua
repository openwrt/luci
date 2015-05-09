-- Copyright 2015 Jonathan Bennett <jbennett@incomsystems.biz>
-- Licensed to the public under the Apache License 2.0.

m = Map("fwknopd", translate("Firewall Knock Operator"))

s = m:section(TypedSection, "global", "Enable Uci/Luci control") -- Set uci control on or off
s.anonymous=true
s:option(Flag, "uci_enabled", "Enable config overwrite", "When unchecked, the config files in /etc/fwknopd will be used as is, ignoring any settings here.")

s = m:section(TypedSection, "access", "access.conf stanzas") -- set the access.conf settings
s.anonymous=true
s.addremove=true
s.dynamic=true
s:option(Value, "SOURCE", "SOURCE", "Use ANY for any source ip")
s:option(Value, "HMAC_KEY", "HMAC_KEY", "The hmac key")
s:option(Value, "KEY", "KEY", "The spa key")

s = m:section(TypedSection, "config", "general config options") -- set the access.conf settings
s.anonymous=true
s.dynamic=true
s:option(Value, "MAX_SPA_PACKET_AGE", "MAX_SPA_PACKET_AGE", "Maximum age in seconds that an SPA packet will be accepted (defaults to 120 seconds)")
return m
