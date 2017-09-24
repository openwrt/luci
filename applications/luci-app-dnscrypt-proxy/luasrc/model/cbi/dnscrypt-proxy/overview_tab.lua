-- Copyright 2017 Dirk Brenken (dev@brenken.org)
-- This is free software, licensed under the Apache License, Version 2.0

local fs        = require("nixio.fs")
local uci       = require("luci.model.uci").cursor()
local util      = require("luci.util")
local date      = require("luci.http.protocol.date")
local res_input = "/usr/share/dnscrypt-proxy/dnscrypt-resolvers.csv"
local dump      = util.ubus("network.interface", "dump", {})
local plug_cnt  = tonumber(luci.sys.exec("env -i /usr/sbin/dnscrypt-proxy --version | grep 'Support for plugins: present' | wc -l"))
local res_list  = {}
local url       = "https://download.dnscrypt.org/dnscrypt-proxy/dnscrypt-resolvers.csv"

if not fs.access("/lib/libustream-ssl.so") then
	m = SimpleForm("error", nil, translate("SSL support not available, please install an libustream-ssl variant to use this package."))
	m.submit = false
	m.reset = false
	return m
end

if not fs.access(res_input) then
	luci.sys.call("env -i /bin/uclient-fetch --no-check-certificate -O " .. res_input .. " " .. url .. " >/dev/null 2>&1")
end

if not uci:get_first("dnscrypt-proxy", "global") then
	uci:add("dnscrypt-proxy", "global")
	uci:save("dnscrypt-proxy")
	uci:commit("dnscrypt-proxy")
end

for line in io.lines(res_input) do
	local name = line:match("^[%w_.-]*")
	res_list[#res_list + 1] = { name = name }
end

m = Map("dnscrypt-proxy", translate("DNSCrypt-Proxy"),
	translate("Configuration of the DNSCrypt-Proxy package. ")
	.. translate("Keep in mind to configure Dnsmasq as well. ")
	.. translatef("For further information "
	.. "<a href=\"%s\" target=\"_blank\">"
	.. "see the wiki online</a>", "https://wiki.openwrt.org/inbox/dnscrypt"))

function m.on_after_commit(self)
	luci.sys.call("env -i /etc/init.d/dnsmasq restart >/dev/null 2>&1")
	luci.sys.call("env -i /etc/init.d/dnscrypt-proxy restart >/dev/null 2>&1")
end

s = m:section(TypedSection, "global", translate("General options"))
s.anonymous = true

-- Main dnscrypt-proxy resource list

o1 = s:option(DummyValue, "", translate("Default Resolver List"))
o1.template = "dnscrypt-proxy/res_options"
o1.value = res_input

o2 = s:option(DummyValue, "", translate("File Date"))
o2.template = "dnscrypt-proxy/res_options"
o2.value = date.to_http(nixio.fs.stat(res_input).mtime)

o3 = s:option(DummyValue, "", translate("File Checksum"))
o3.template = "dnscrypt-proxy/res_options"
o3.value = luci.sys.exec("sha256sum " .. res_input .. " | awk '{print $1}'")

btn = s:option(Button, "", translate("Refresh Resolver List"))
btn.inputtitle = translate("Refresh List")
btn.inputstyle = "apply"
btn.disabled = false
function btn.write(self, section, value)
	luci.sys.call("env -i /bin/uclient-fetch --no-check-certificate -O " .. res_input .. " " .. url .. " >/dev/null 2>&1")
	luci.http.redirect(luci.dispatcher.build_url("admin", "services", "dnscrypt-proxy"))
end

-- Trigger settings

t = s:option(DynamicList, "procd_trigger", translate("Startup Trigger"),
	translate("By default the DNSCrypt-Proxy startup will be triggered by ifup events of multiple network interfaces. ")
	.. translate("To restrict the trigger, add only the relevant network interface(s). ")
	.. translate("Usually the 'wan' interface should work for most users."))
if dump then
	local i, v
	for i, v in ipairs(dump.interface) do
		if v.interface ~= "loopback" then
			t:value(v.interface)
		end
	end
end
t.rmempty = true

-- Extra options

ds = s:option(DummyValue, "_dummy", translate("Extra options"),
	translate("Options for further tweaking in case the defaults are not suitable for you."))
ds.template = "cbi/nullsection"

btn = s:option(Button, "", translate("Create custom config file"),
	translate("Create '/etc/resolv-crypt.conf' with 'options timeout:1' to reduce DNS upstream timeouts with multiple DNSCrypt instances. ")
	.. translatef("For further information "
	.. "<a href=\"%s\" target=\"_blank\">"
	.. "see the wiki online</a>", "https://wiki.openwrt.org/inbox/dnscrypt"))
btn.inputtitle = translate("Create Config File")
btn.inputstyle = "apply"
btn.disabled = false
function btn.write(self, section, value)
	if not fs.access("/etc/resolv-crypt.conf") then
		luci.sys.call("env -i echo 'options timeout:1' > '/etc/resolv-crypt.conf'")
	end
end

-- Mandatory options per instance

s = m:section(TypedSection, "dnscrypt-proxy", translate("Instance options"))
s.anonymous = true
s.addremove = true

o1 = s:option(Value, "address", translate("IP Address"),
	translate("The local IPv4 or IPv6 address. The latter one should be specified within brackets, e.g. '[::1]'."))
o1.default = address or "127.0.0.1"
o1.rmempty = false

o2 = s:option(Value, "port", translate("Port"),
	translate("The listening port for DNS queries."))
o2.datatype = "port"
o2.default = port
o2.rmempty = false

o3 = s:option(ListValue, "resolver", translate("Resolver"),
	translate("Name of the remote DNS service for resolving queries."))
o3.datatype = "hostname"
o3.widget = "select"
local i, v
for i, v in ipairs(res_list) do
	if v.name ~= "Name" then
		o3:value(v.name)
	end
end
o3.default = resolver
o3.rmempty = false

-- Extra options per instance

e1 = s:option(Value, "resolvers_list", translate("Alternate Resolver List"),
	translate("Specify a non-default Resolver List."))
e1.datatype = "file"
e1.optional = true

e2 = s:option(Value, "ephemeral_keys", translate("Ephemeral Keys"),
	translate("Improve privacy by using an ephemeral public key for each query. ")
	.. translate("This option requires extra CPU cycles and is useless with most DNSCrypt server."))
e2.datatype = "bool"
e2.value = 1
e2.optional = true

if plug_cnt > 0 then
	e3 = s:option(DynamicList, "blacklist", translate("Blacklist"),
		translate("Local blacklists allow you to block abuse sites by domains or ip addresses. ")
		.. translate("The value for this property is the blocklist type and path to the file, e.g.'domains:/path/to/dbl.txt' or 'ips:/path/to/ipbl.txt'."))
	e3.optional = true

	e4 = s:option(Value, "block_ipv6", translate("Block IPv6"),
		translate("Disable IPv6 to speed up DNSCrypt-Proxy."))
	e4.datatype = "bool"
	e4.value = 1
	e4.optional = true

	e5 = s:option(Value, "local_cache", translate("Local Cache"),
		translate("Enable Caching to speed up DNSCcrypt-Proxy."))
	e5.datatype = "bool"
	e5.value = 1
	e5.optional = true
	
	e6 = s:option(Value, "query_log_file", translate("DNS Query Logfile"),
	translate("Log the received DNS queries to a file, so you can watch in real-time what is happening on the network."))
	e6.optional = true
end

return m
