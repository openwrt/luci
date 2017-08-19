-- Copyright 2015 Daniel Dickinson <openwrt@daniel.thecshore.com>
-- Copyright 2017 Alexander Schlarb <alexander@ninetailed.ninja>
-- Licensed to the public under the Apache License 2.0.

local fs = require("nixio.fs")

local m = Map("uhttpd", translate("uHTTPd"),
	      translate("A lightweight single-threaded HTTP(S) server"))

local ucs = m:section(TypedSection, "uhttpd", "")
ucs.addremove = true
ucs.anonymous = false

local lhttp = nil
local lhttps = nil
local cert_file = nil
local key_file = nil

ucs:tab("general", translate("General Settings"))
ucs:tab("server", translate("Web Server Settings"), translate("Settings primarily geared towards serving more than the web UI"))
ucs:tab("advanced", translate("Advanced Settings"), translate("Rarely needed settings that can affect serving the WebUI"))

lhttp = ucs:taboption("general", DynamicList, "listen_http", translate("HTTP Server-Addresses (Address:Port)"), translate("Bind to specific interface:port (by specifying interface address)"))
lhttp.datatype = "list(ipaddrport(1))"

function lhttp.validate(self, value, section)
        local have_https_listener = false
        local have_http_listener = false
	if lhttp and lhttp:formvalue(section) and (#(lhttp:formvalue(section)) > 0) then
		for k, v in pairs(lhttp:formvalue(section)) do
			if v and (v ~= "") then
				have_http_listener = true
				break
			end
		end
	end
	if lhttps and lhttps:formvalue(section) and (#(lhttps:formvalue(section)) > 0) then
		for k, v in pairs(lhttps:formvalue(section)) do
			if v and (v ~= "") then
				have_https_listener = true
				break
			end
		end
	end
	if not (have_http_listener or have_https_listener) then
		return nil, "must listen on at list one address:port"
	end
	return DynamicList.validate(self, value, section)
end

lhttps = ucs:taboption("general", DynamicList, "listen_https", translate("HTTPS Server-Addresses (Address:Port)"), translate("Bind to specific interface:port (by specifying interface address)"))
lhttps.datatype = "list(ipaddrport(1))"
lhttps:depends("cert")
lhttps:depends("key")

function lhttps.validate(self, value, section)
        local have_https_listener = false
        local have_http_listener = false
	if lhttps and lhttps:formvalue(section) and (#(lhttps:formvalue(section)) > 0) then
		for k, v in pairs(lhttps:formvalue(section)) do
			if v and (v ~= "") then
				have_https_listener = true
				break
			end
		end
		if have_https_listener and ((not cert_file) or (not cert_file:formvalue(section)) or (cert_file:formvalue(section) == ""))  then
			return nil, "must have certificate when using https"
		end
		if have_https_listener and ((not key_file) or (not key_file:formvalue(section)) or (key_file:formvalue(section) == "")) then
			return nil, "must have key when using https"
		end
	end
	if lhttp and (lhttp:formvalue(section)) and (#lhttp:formvalue(section) > 0) then
		for k, v in pairs(lhttp:formvalue(section)) do
			if v and (v ~= "") then
				have_http_listener = true
				break
			end
		end
	end
	if not (have_http_listener or have_https_listener) then
		return nil, "must listen on at list one address:port"
	end
	return DynamicList.validate(self, value, section)
end

o = ucs:taboption("general", Flag, "redirect_https", translate("Redirect all HTTP requests to HTTPS"))
o.default = o.enabled
o.rmempty = false

o = ucs:taboption("general", Flag, "rfc1918_filter", translate("Ignore private IP addresses on public interfaces"), translate("Prevent access from private (RFC1918) IPs on an interface if it has an public IP address"))
o.default = o.enabled
o.rmempty = false

cert_file = ucs:taboption("general", FileUpload, "cert", translate("HTTPS Certificate (DER encoded)"))

key_file = ucs:taboption("general", FileUpload, "key", translate("HTTPS Private Key (DER encoded)"))

o = ucs:taboption("general", Button, "remove_old", translate("Generate new certificate and key"),
		  translate("uHTTPd will generate a new self-signed certificate using the configuration shown below"))
o.inputstyle = "remove"

function o.write(self, section)
	if cert_file:cfgvalue(section) and fs.access(cert_file:cfgvalue(section)) then fs.unlink(cert_file:cfgvalue(section)) end
	if key_file:cfgvalue(section) and fs.access(key_file:cfgvalue(section)) then fs.unlink(key_file:cfgvalue(section)) end
	luci.sys.call("/etc/init.d/uhttpd restart")
	luci.http.redirect(luci.dispatcher.build_url("admin", "services", "uhttpd"))
end

o = ucs:taboption("general", Button, "remove_conf", translate("Remove certificate and key configuration"),
	translate("Permanently delete the certificate and key, as well as the configuration to use them"))
o.inputstyle = "remove"

function o.write(self, section)
	if cert_file:cfgvalue(section) and fs.access(cert_file:cfgvalue(section)) then fs.unlink(cert_file:cfgvalue(section)) end
	if key_file:cfgvalue(section) and fs.access(key_file:cfgvalue(section)) then fs.unlink(key_file:cfgvalue(section)) end
	self.map:del(section, "cert")
	self.map:del(section, "key")
	self.map:del(section, "listen_https")
	luci.http.redirect(luci.dispatcher.build_url("admin", "services", "uhttpd"))
end

o = ucs:taboption("server", DynamicList, "index_page", translate("Index page(s)"), translate("e.g.: enter index.html and index.php when using PHP"))
o.optional = true
o.placeholder = "index.html"

o = ucs:taboption("server", DynamicList, "interpreter", translate("CGI filetype handler"), translate("Interpreter to associate with file endings ('suffix=handler', e.g. '.php=/usr/bin/php-cgi')"))
o.optional = true

o = ucs:taboption("server", Flag, "no_symlinks", translate("Do not follow symlinks outside of the document root"))
o.optional = true

o = ucs:taboption("server", Flag, "no_dirlists", translate("Do not generate directory listings"))
o.default = o.disabled

o = ucs:taboption("server", DynamicList, "alias", translate("Aliases"), translate("(/old/path=/new/path) or (just /old/path which becomes /cgi-prefix/old/path)"))
o.optional = true

o = ucs:taboption("server", Value, "realm", translate("Realm for Basic Auth"))
o.optional = true
o.placeholder = luci.sys.hostname() or "OpenWrt"

local httpconfig = ucs:taboption("server", Value, "config", translate("Config file (e.g. for Basic Auth credentials)"), translate("HTTP authentication will not be available if empty"))
httpconfig.optional = true

o = ucs:taboption("server", Value, "error_page", translate("404 Error Page"), translate("URL or CGI script to display on status '404 Not Found'; must begin with a '/'"))
o.optional = true

o = ucs:taboption("advanced", Value, "home", translate("Document root"),
		  translate("Base directory for files to be served"))
o.default = "/www"
o.datatype = "directory"

o = ucs:taboption("advanced", Value, "cgi_prefix", translate("Path prefix for CGI scripts"), translate("CGI support will be disabled if empty"))
o.optional = true

o = ucs:taboption("advanced", Value, "lua_prefix", translate("URL path prefix for Lua scripts"))
o.placeholder = "/lua"
o.optional = true

o = ucs:taboption("advanced", Value, "lua_handler", translate("Filesystem path of Lua runtime initialization script"), translate("Embedded Lua interpreter will be disabled if empty"))
o.optional = true

o = ucs:taboption("advanced", Value, "ubus_prefix", translate("URL path prefix for ubus JSON-RPC"), translate("ubus integration will be disabled if empty"))
o.optional = true

o = ucs:taboption("advanced", Value, "ubus_socket", translate("Override path for ubus socket"))
o.optional = true

o = ucs:taboption("advanced", Flag, "ubus_cors", translate("Enable JSON-RPC Cross-Origin Resource Sharing"))
o.default = o.disabled
o.optional = true

o = ucs:taboption("advanced", Flag, "no_ubusauth", translate("Disable JSON-RPC authorization when using the ubus session API"))
o.optional= true
o.default = o.disabled

o = ucs:taboption("advanced", Value, "script_timeout", translate("Maximum wait time for Lua, CGI, or ubus execution"))
o.placeholder = 60
o.datatype = "uinteger"
o.optional = true

o = ucs:taboption("advanced", Value, "network_timeout", translate("Maximum wait time for network activity"))
o.placeholder = 30
o.datatype = "uinteger"
o.optional = true

o = ucs:taboption("advanced", Value, "http_keepalive", translate("HTTP Keepalive"))
o.placeholder = 20
o.datatype = "uinteger"
o.optional = true

o = ucs:taboption("advanced", Value, "tcp_keepalive", translate("TCP Keepalive"))
o.optional = true
o.datatype = "uinteger"
o.default = 1

o = ucs:taboption("advanced", Value, "max_connections", translate("Maximum number of connections"))
o.optional = true
o.datatype = "uinteger"

o = ucs:taboption("advanced", Value, "max_requests", translate("Maximum number of script requests"))
o.optional = true
o.datatype = "uinteger"

local s = m:section(TypedSection, "cert", translate("Parameters for Generating Certificates"))

s.template  = "cbi/tsection"
s.anonymous = true

o = s:option(Value, "days", translate("Validity (days)"))
o.default = 730
o.datatype = "uinteger"

o = s:option(Value, "bits", translate("Length of key in bits"))
o.default = 2048
o.datatype = "min(1536)"

o = s:option(Value, "commonname", translate("Server Hostname"), translate("X.509 CommonName field"))
o.default = luci.sys.hostname()

o = s:option(Value, "country", translate("Country"))
o.default = "ZZ"

o = s:option(Value, "state", translate("State"))
o.default = "Unknown"

o = s:option(Value, "location", translate("Locality (i.e. nearby city)"))
o.default = "Somewhere"

return m
