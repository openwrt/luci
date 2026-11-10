-- LuCI CBI model for mitmproxy Settings page
-- Provides the complete configuration interface

local m, s, o

m = Map("mitmproxy", translate("mitmproxy Settings"),
    translate("Configure the mitmproxy HTTP proxy. Saving restarts the service automatically."))

-- ═══════════════════════════════════════════════════════════════════════
-- Section: General Settings
-- ═══════════════════════════════════════════════════════════════════════
s = m:section(NamedSection, "main", "mitmproxy",
    translate("General Settings"))
s.addremove = false
s.anonymous = false

o = s:option(Flag, "enabled", translate("Enable Service"),
    translate("Start mitmproxy proxy service"))
o.default = "0"
o.rmempty = false

o = s:option(Value, "listen_host", translate("Listen Address"),
    translate("IP address to bind the proxy to. Use 0.0.0.0 for all interfaces."))
o.default = "0.0.0.0"
o.datatype = "ipaddr"
o.rmempty = false

o = s:option(Value, "listen_port", translate("Proxy Port"),
    translate("Port for the proxy server"))
o.default = "8080"
o.datatype = "port"
o.rmempty = false

o = s:option(ListValue, "mode", translate("Proxy Mode"),
    translate("Operating mode of the proxy"))
o:value("regular", translate("Regular HTTP Proxy"))
o:value("transparent", translate("Transparent Proxy"))
o:value("socks5", translate("SOCKS5 Proxy"))
o:value("upstream", translate("Upstream Proxy"))
o:value("reverse", translate("Reverse Proxy"))
o.default = "regular"

o = s:option(Value, "upstream_server", translate("Upstream/Reverse Server"),
    translate("Required for these modes. Upstream: the next proxy (e.g. http://10.0.0.2:3128). "
    .. "Reverse: the server to forward to (e.g. https://example.com)."))
o:depends("mode", "upstream")
o:depends("mode", "reverse")
o.placeholder = "https://example.com"
o.rmempty = false

o = s:option(Value, "transparent_iface", translate("Intercept Interface"),
    translate("Transparent mode redirects IPv4 TCP ports 80 and 443 arriving on this "
    .. "interface to the proxy (nftables table inet mitmproxy). Clients must trust "
    .. "the mitmproxy CA for HTTPS."))
o:depends("mode", "transparent")
o.default = "br-lan"
o.placeholder = "br-lan"

o = s:option(Flag, "ssl_insecure", translate("SSL Insecure"),
    translate("Do not verify upstream server SSL/TLS certificates"))
o.default = "0"

o = s:option(Value, "confdir", translate("Config Directory"),
    translate("Path to mitmproxy configuration and certificates directory"))
o.default = "/etc/mitmproxy/certs"
o.rmempty = false


-- ═══════════════════════════════════════════════════════════════════════
-- Section: Web Interface
-- ═══════════════════════════════════════════════════════════════════════
s = m:section(NamedSection, "main", "mitmproxy",
    translate("Web Interface (mitmweb)"))
s.addremove = false

o = s:option(Value, "web_host", translate("Web UI Listen Address"),
    translate("Address for the mitmweb interface"))
o.default = "0.0.0.0"
o.datatype = "ipaddr"

o = s:option(Value, "web_port", translate("Web UI Port"),
    translate("Port for the mitmweb interface"))
o.default = "8081"
o.datatype = "port"

o = s:option(Value, "web_password", translate("Web UI Token"),
    translate("mitmweb only answers requests that carry this token. It is created "
    .. "on first start; clear it to generate a new one."))
o.password = true

-- ═══════════════════════════════════════════════════════════════════════
-- Section: Interception Settings
-- ═══════════════════════════════════════════════════════════════════════
s = m:section(NamedSection, "interception", "mitmproxy",
    translate("Interception Settings"))
s.addremove = false

o = s:option(Value, "intercept", translate("Intercept Filter"),
    translate("Flow filter expression for interception (mitmproxy filter syntax). "
    .. "Example: ~d example.com & ~m GET"))
o.placeholder = "~d example.com"

o = s:option(DynamicList, "ignore_hosts", translate("Ignore Hosts"),
    translate("Regex patterns of hosts to ignore (pass through without inspection). "
    .. "One pattern per line."))
o.placeholder = ".*\\.googleapis\\.com"

o = s:option(DynamicList, "allow_hosts", translate("Allow Hosts"),
    translate("Only intercept traffic matching these host patterns. "
    .. "If set, all non-matching traffic is passed through."))
o.placeholder = ".*\\.example\\.com"

o = s:option(Flag, "anticache", translate("Anti-Cache"),
    translate("Strip cache headers from requests and responses to force "
    .. "content to be fetched fresh every time."))
o.default = "0"

o = s:option(Flag, "anticomp", translate("Anti-Compression"),
    translate("Strip compression headers to force uncompressed responses, "
    .. "making content inspection easier."))
o.default = "0"

-- ═══════════════════════════════════════════════════════════════════════
-- Section: Logging
-- ═══════════════════════════════════════════════════════════════════════
s = m:section(NamedSection, "logging", "mitmproxy",
    translate("Logging"))
s.addremove = false

o = s:option(ListValue, "log_level", translate("Log Level"),
    translate("Verbosity of mitmproxy's messages in the system log (logread)"))
o:value("error", translate("Error"))
o:value("warn", translate("Warning"))
o:value("info", translate("Info"))
o:value("debug", translate("Debug"))
o.default = "info"

-- ═══════════════════════════════════════════════════════════════════════
-- Section: Advanced / Script
-- ═══════════════════════════════════════════════════════════════════════
s = m:section(NamedSection, "main", "mitmproxy",
    translate("Advanced"))
s.addremove = false

o = s:option(Value, "script", translate("Custom Script"),
    translate("Path to a Python script loaded by mitmproxy for custom traffic processing"))
o.placeholder = "/etc/mitmproxy/scripts/custom.py"

o = s:option(DynamicList, "extra_args", translate("Extra Arguments"),
    translate("Additional mitmweb command-line arguments. Each entry is split on spaces, "
    .. "so values cannot contain spaces."))
o.placeholder = "--set connection_strategy=lazy"

return m
