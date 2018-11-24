-- Copyright (C) 2014-2017 Jian Chang <aa65535@live.com>
-- Licensed to the public under the GNU General Public License v3.

local m, s, o
local shadowsocksr = "shadowsocksr"
local uci = luci.model.uci.cursor()
local servers = {}

local function has_bin(name)
	return luci.sys.call("command -v %s >/dev/null" %{name}) == 0
end

local function has_ss_bin()
	return has_bin("ssr-redir"), has_bin("ssr-local"), has_bin("ssr-tunnel")
end

local function has_udp_relay()
	return luci.sys.call("lsmod | grep -q TPROXY && command -v ip >/dev/null") == 0
end

local has_redir, has_local, has_tunnel = has_ss_bin()

if not has_redir and not has_local and not has_tunnel then
	return Map(shadowsocksr, "%s - %s" %{translate("ShadowSocksR"),
		translate("General Settings")}, '<b style="color:red">shadowsocksr-libev binary file not found.</b>')
end

local function is_running(name)
	return luci.sys.call("pidof %s >/dev/null" %{name}) == 0
end

local function get_status(name)
	return is_running(name) and translate("RUNNING") or translate("NOT RUNNING")
end

uci:foreach(shadowsocksr, "servers", function(s)
	if s.server and s.server_port then
		servers[#servers+1] = {name = s[".name"], alias = s.alias or "%s:%s" %{s.server, s.server_port}}
	end
end)

m = Map(shadowsocksr, "%s - %s" %{translate("ShadowSocksR"), translate("General Settings")})
m.template = "shadowsocksr/general"

-- [[ Running Status ]]--
s = m:section(TypedSection, "general", translate("Running Status"))
s.anonymous = true

if has_redir then
	o = s:option(DummyValue, "_redir_status", translate("Transparent Proxy"))
	o.value = "<span id=\"_redir_status\">%s</span>" %{get_status("ss-redir")}
	o.rawhtml = true
end

if has_local then
	o = s:option(DummyValue, "_local_status", translate("SOCKS5 Proxy"))
	o.value = "<span id=\"_local_status\">%s</span>" %{get_status("ss-local")}
	o.rawhtml = true
end

if has_tunnel then
	o = s:option(DummyValue, "_tunnel_status", translate("Port Forward"))
	o.value = "<span id=\"_tunnel_status\">%s</span>" %{get_status("ss-tunnel")}
	o.rawhtml = true
end

s = m:section(TypedSection, "general", translate("Global Settings"))
s.anonymous = true

o = s:option(Value, "startup_delay", translate("Startup Delay"))
o:value(0, translate("Not enabled"))
for _, v in ipairs({5, 10, 15, 25, 40}) do
	o:value(v, translatef("%u seconds", v))
end
o.datatype = "uinteger"
o.default = 0
o.rmempty = false

-- [[ Transparent Proxy ]]--
if has_redir then
	s = m:section(TypedSection, "transparent_proxy", translate("Transparent Proxy"))
	s.anonymous = true

	o = s:option(DynamicList, "main_server", translate("Main Server"))
	o.template = "shadowsocksr/dynamiclist"
	o:value("nil", translate("Disable"))
	for _, s in ipairs(servers) do o:value(s.name, s.alias) end
	o.default = "nil"
	o.rmempty = false

	o = s:option(ListValue, "udp_relay_server", translate("UDP-Relay Server"))
	if has_udp_relay() then
		o:value("nil", translate("Disable"))
		o:value("same", translate("Same as Main Server"))
		for _, s in ipairs(servers) do o:value(s.name, s.alias) end
	else
		o:value("nil", translate("Unusable - Missing iptables-mod-tproxy or ip"))
	end
	o.default = "nil"
	o.rmempty = false

	o = s:option(Value, "local_port", translate("Local Port"))
	o.datatype = "port"
	o.default = 1234
	o.rmempty = false

	o = s:option(Value, "mtu", translate("Override MTU"))
	o.datatype = "range(296,9200)"
	o.default = 1492
	o.rmempty = false
end

-- [[ SOCKS5 Proxy ]]--
if has_local then
	s = m:section(TypedSection, "socks5_proxy", translate("SOCKS5 Proxy"))
	s.anonymous = true

	o = s:option(DynamicList, "server", translate("Server"))
	o.template = "shadowsocksr/dynamiclist"
	o:value("nil", translate("Disable"))
	for _, s in ipairs(servers) do o:value(s.name, s.alias) end
	o.default = "nil"
	o.rmempty = false

	o = s:option(Value, "local_port", translate("Local Port"))
	o.datatype = "port"
	o.default = 1080
	o.rmempty = false

	o = s:option(Value, "mtu", translate("Override MTU"))
	o.datatype = "range(296,9200)"
	o.default = 1492
	o.rmempty = false
end

-- [[ Port Forward ]]--
if has_tunnel then
	s = m:section(TypedSection, "port_forward", translate("Port Forward"))
	s.anonymous = true

	o = s:option(DynamicList, "server", translate("Server"))
	o.template = "shadowsocksr/dynamiclist"
	o:value("nil", translate("Disable"))
	for _, s in ipairs(servers) do o:value(s.name, s.alias) end
	o.default = "nil"
	o.rmempty = false

	o = s:option(Value, "local_port", translate("Local Port"))
	o.datatype = "port"
	o.default = 5300
	o.rmempty = false

	o = s:option(Value, "destination", translate("Destination"))
	o.default = "8.8.4.4:53"
	o.rmempty = false

	o = s:option(Value, "mtu", translate("Override MTU"))
	o.datatype = "range(296,9200)"
	o.default = 1492
	o.rmempty = false
end


if nixio.fs.access("/usr/share/dnsmasq/trust-anchors.conf") then
	s = m:section(TypedSection, "dns_poisoning", translate("DNS poisoning"))
	s.anonymous = true
	
	o = s:option(ListValue, "method", translate("Processing method"))
	o:value("nil", translate("Disable"))
	if has_bin("cdns") then
		o:value("cdns", "CDNS")
	end
	if has_bin("pdnsd") then
		o:value("pdnsd", "Pdnsd (OpenDNS)")
	end
	if has_bin("dns-forwarder") then
		o:value("dnsforwarder", "DNS Forwarder (TUNA DNS)")
	end
	if has_bin("https_dns_proxy") then
		o:value("https_dns_proxy", "https_dns_proxy (Google DNS)")
	end
	o:value("unknown","127.0.0.1:5300")
	o.default = "nil"
	o.rmempty = false
	
	if nixio.fs.access("/usr/share/shadowsocksr/update.sh") and nixio.fs.access("/usr/share/shadowsocksr/gfwlist2dnsmasq.sh") and has_bin("base64") and has_bin("curl") then
		o = s:option(Button,"update",translate("Update poisoning list"))
		o.write = function()
			luci.sys.call("/usr/share/shadowsocksr/update.sh >/dev/null 2>&1")
			luci.http.redirect(luci.dispatcher.build_url("admin", "services", "shadowsocksr", "general"))
		end
	end
end



return m
