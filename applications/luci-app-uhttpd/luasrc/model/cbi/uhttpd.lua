--[[

 uHttpd Luci configuration module.
 Copyright (c) 2015, GuoGuo <gch981213@gmail.com>

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

]]--

local fs = require "nixio.fs"

m = Map("uhttpd", translate("HTTP Service"),
        translatef(" uHTTPd is a tiny single threaded HTTP server with TLS, CGI and Lua support. It is intended as a drop-in replacement for the Busybox HTTP daemon."))

s = m:section(TypedSection, "uhttpd", translate("Settings"))
s.anonymous = false
s.addremove = true

s:option(DynamicList, "listen_http", translate("Listen HTTP"), translate("Specifies the ports and addresses to listen on for plain HTTP access. If only a port number is given, the server will attempt to serve both IPv4 and IPv6 requests. Use 0.0.0.0:80 to bind at port 80 only on IPv4 interfaces or [::]:80 to serve only IPv6."))

s:option(DynamicList, "listen_https", translate("Listen HTTPS"), translate("Specifies the ports and addresses to listen on for encrypted HTTPS access. The format is the same as for Listen HTTP."))

s:option(DynamicList, "index_page", translate("Index pages"), translate("Index file to use for directories."))

home = s:option(Value, "home", translate("Document Root"), translate("Defines the server document root."))
home.optional = false

s:option(Flag, "rfc1918_filter", translate("Enable RFC1918 Filter"), translate("Reject requests from RFC1918 IP addresses directed to the servers public IP(s). This is a DNS rebinding countermeasure."))

max_requests = s:option(Value, "max_requests", translate("Max requests"),translate("Maximum number of concurrent requests.If this number is exceeded, further requests are queued until the number of running requests drops below the limit again."))
max_requests.datatype = "range(0,360000)"
max_requests.optional = false
max_requests.placeholder = "3"

max_connections = s:option(Value, "max_connections", translate("Max connections"),translate("Maximum number of concurrent connections. If this number is exceeded, further TCP connection attempts are queued until the number of active connections drops below the limit again."))
max_connections.datatype = "range(0,360000)"
max_connections.optional = false
max_connections.placeholder = "100"

s:option(Value, "cert", translate("ASN.1/DER certificate path"))
s:option(Value, "key", translate("ASN.1/DER private key path"),translate("Certificate and private key for HTTPS. If no 'Listen HTTPS' addresses are given, the key options are ignored."))

cgipf = s:option(Value, "cgi_prefix", translate("CGI url prefix"),translate("Defines the prefix for CGI scripts, relative to the document root. CGI support is disabled if this option is missing."))
cgipf.placeholder = "/cgi-bin"

interpreter = s:option(DynamicList, "interpreter", translate("Interpreters"), translate("List of extension->interpreter mappings.Files with an associated interpreter can be called outside of the CGI prefix and do not need to be executable."))
interpreter.placeholder = ".php=/usr/bin/php-cgi"


if (os.execute("opkg list | grep uhttpd-mod-lua -q") == 0) then
	luapf = s:option(Value, "lua_prefix", translate("Lua prefix"))
	luapf.placeholder = "/luci"

	lua_handler = s:option(Value, "lua_handler", translate("Lua handler"), translate("Lua url prefix and handler script.Embedded Lua support is disabled if no prefix given."))
	lua_handler.placeholder = "/luci"
end

script_timeout = s:option(Value, "script_timeout", translate("CGI/Lua timeout"), translate("If the called script does not write data within the given amount of seconds, the server will terminate the request with 504 Gateway Timeout response."))
script_timeout.datatype = "range(0,360000)"
script_timeout.optional = false
script_timeout.placeholder = "60"

network_timeout = s:option(Value, "network_timeout", translate("Network timeout"), translate("If the current connection is blocked for the specified amount of seconds, the server will terminate the associated request process."))
network_timeout.datatype = "range(0,360000)"
network_timeout.optional = false
network_timeout.placeholder = "30"

http_keepalive = s:option(Value, "http_keepalive", translate("HTTP Keep-Alive"), translate("Specifies the timeout for persistent HTTP/1.1 connections. Setting this to 0 will disable persistent HTTP connections."))
http_keepalive.datatype = "range(0,360000)"
http_keepalive.optional = false
http_keepalive.placeholder = "20"

tcp_keepalive = s:option(Value, "tcp_keepalive", translate("TCP Keep-Alive"), translate("Send periodic keep-alive probes over established connections to detect dead peers. The value is given in seconds to specify the interval between subsequent probes. Setting this to 0 will disable TCP keep-alive."))
tcp_keepalive.datatype = "range(0,360000)"
tcp_keepalive.optional = false
tcp_keepalive.placeholder = "1"

no_symlinks = s:option(Flag, "no_symlinks", translate("No symlinks"), translate("Do not follow symlinks that point outside of the document root."))
no_symlinks.default = no_symlinks.enabled

no_dirlists = s:option(Flag, "no_dirlists", translate("No dirlists"), translate("Do not produce directory listings but send 403 instead if a client requests an url pointing to a directory without any index file."))
no_dirlists.default = no_dirlists.enabled

s:option(Value, "config", translate("External config file path"), translate("External configuration file in busybox httpd format."))
return m


