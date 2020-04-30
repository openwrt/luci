--[[
LuCI - Lua Configuration Interface

Copyright 2016 Toke Høiland-Jørgensen <toke@toke.dk>

# This program is free software; you can redistribute it and/or modify it under
# the terms of the GNU General Public License as published by the Free Software
# Foundation; either version 3 of the License, or (at your option) any later
# version.

]]--

local fs = require "nixio.fs"

local nginx_presence = fs.access("/usr/sbin/nginx") or false
local uhttpd_presence = fs.access("/usr/sbin/uhttpd") or false

m = Map("acme", translate("ACME certificates"),
	translate("This configures ACME (Letsencrypt) automatic certificate installation. " ..
                  "Simply fill out this to have the router configured with Letsencrypt-issued " ..
                  "certificates for the web interface. " ..
                  "Note that the domain names in the certificate must already be configured to " ..
                  "point at the router's public IP address. " ..
                  "Once configured, issuing certificates can take a while. " ..
                  "Check the logs for progress and any errors."))

s = m:section(TypedSection, "acme", translate("ACME global config"))
s.anonymous = true

st = s:option(Value, "state_dir", translate("State directory"),
              translate("Where certs and other state files are kept."))
st.rmempty = false
st.datatype = "directory"

ae = s:option(Value, "account_email", translate("Account email"),
              translate("Email address to associate with account key."))
ae.rmempty = false
ae.datatype = "minlength(1)"

d = s:option(Flag, "debug", translate("Enable debug logging"))
d.rmempty = false

cs = m:section(TypedSection, "cert", translate("Certificate config"))
cs.anonymous = false
cs.addremove = true

e = cs:option(Flag, "enabled", translate("Enabled"))
e.rmempty = false

us = cs:option(Flag, "use_staging", translate("Use staging server"),
               translate("Get certificate from the Letsencrypt staging server " ..
                         "(use for testing; the certificate won't be valid)."))
us.rmempty = false

kl = cs:option(ListValue, "keylength", translate("Key size"),
               translate("Key size (and type) for the generated certificate."))
kl:value("2048", "RSA 2048 bits")
kl:value("3072", "RSA 3072 bits")
kl:value("4096", "RSA 4096 bits")
kl:value("ec-256", "ECC 256 bits")
kl:value("ec-384", "ECC 384 bits")
kl.default = "2048"
kl.rmempty = false

if uhttpd_presence then
u = cs:option(Flag, "update_uhttpd", translate("Use for uhttpd"),
              translate("Update the uhttpd config with this certificate once issued " ..
                        "(only select this for one certificate)." ..
                        "Is also available luci-app-uhttpd to configure uhttpd form the LuCI interface."))
u.rmempty = false
end

if nginx_presence then
u = cs:option(Flag, "update_nginx", translate("Use for nginx"),
              translate("Update the nginx config with this certificate once issued " ..
                        "(only select this for one certificate)." ..
                        "Nginx must support ssl, if not it won't start as it needs to be " ..
                        "compiled with ssl support to use cert options"))
u.rmempty = false
end

wr = cs:option(Value, "webroot", translate("Webroot directory"),
               translate("Webserver root directory. Set this to the webserver " ..
                         "document root to run Acme in webroot mode. The web " ..
                         "server must be accessible from the internet on port 80."))
wr.optional = true

dom = cs:option(DynamicList, "domains", translate("Domain names"),
                translate("Domain names to include in the certificate. " ..
                          "The first name will be the subject name, subsequent names will be alt names. " ..
                          "Note that all domain names must point at the router in the global DNS."))
dom.datatype = "list(string)"

dns = cs:option(Value, "dns", translate("DNS API"),
                translate("To use DNS mode to issue certificates, set this to the name of a DNS API supported by acme.sh. " ..
                          "See https://github.com/Neilpang/acme.sh/tree/master/dnsapi for the list of available APIs. " ..
                          "In DNS mode, the domain name does not have to resolve to the router IP. " ..
                          "DNS mode is also the only mode that supports wildcard certificates. " ..
                          "Using this mode requires the acme-dnsapi package to be installed."))
dns.optional = true

cred = cs:option(DynamicList, "credentials", translate("DNS API credentials"),
                 translate("The credentials for the DNS API mode selected above. " ..
                           "See https://github.com/Neilpang/acme.sh/tree/master/dnsapi#how-to-use-dns-api for the format of credentials required by each API. " ..
                           "Add multiple entries here in KEY=VAL shell variable format to supply multiple credential variables."))
cred.datatype = "list(string)"

return m
