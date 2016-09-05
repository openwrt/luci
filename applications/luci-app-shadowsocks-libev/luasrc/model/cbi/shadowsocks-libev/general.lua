-- Copyright (C) 2016 Jian Chang <aa65535@live.com>
-- Licensed to the public under the GNU General Public License v3.

local m, s, o
local shadowsocks = "shadowsocks-libev"
local ipkg = require("luci.model.ipkg")
local uci = luci.model.uci.cursor()
local server_table = {}

local function has_bin(name)
	return luci.sys.call("command -v %s >/dev/null" %{name}) == 0
end

local function has_ss_bin()
	return has_bin("ss-redir"), has_bin("ss-local"), has_bin("ss-tunnel")
end

local has_redir, has_local, has_tunnel = has_ss_bin()

if not has_redir and not has_local and not has_tunnel then
	return Map(shadowsocks, "%s - %s" %{translate("ShadowSocks"),
		translate("General Settings")}, '<b style="color:red">shadowsocks-libev binary file not found.</b>')
end

local function is_running(name)
	return luci.sys.call("pidof %s >/dev/null" %{name}) == 0
end

local function get_status(name)
	return is_running(name) and translate("RUNNING") or translate("NOT RUNNING")
end

uci:foreach(shadowsocks, "servers", function(s)
	if s.alias then
		server_table[s[".name"]] = s.alias
	elseif s.server and s.server_port then
		server_table[s[".name"]] = "%s:%s" %{s.server, s.server_port}
	end
end)

m = Map(shadowsocks, "%s - %s" %{translate("ShadowSocks"), translate("General Settings")})

-- [[ Running Status ]]--
s = m:section(TypedSection, "transparent_proxy", translate("Running Status"))
s.anonymous = true

if has_redir then
	o = s:option(DummyValue, "_status", translate("Transparent Proxy"))
	o.value = get_status("ss-redir")
end

if has_local then
	o = s:option(DummyValue, "_status", translate("SOCKS5 Proxy"))
	o.value = get_status("ss-local")
end

if has_tunnel then
	o = s:option(DummyValue, "_status", translate("Port Forward"))
	o.value = get_status("ss-tunnel")
end

-- [[ Transparent Proxy ]]--
if has_redir then
	s = m:section(TypedSection, "transparent_proxy", translate("Transparent Proxy"))
	s.anonymous = true

	o = s:option(ListValue, "main_server", translate("Main Server"))
	o:value("nil", translate("Disable"))
	for k, v in pairs(server_table) do o:value(k, v) end
	o.default = "nil"
	o.rmempty = false

	o = s:option(ListValue, "udp_relay_server", translate("UDP-Relay Server"))
	if ipkg.installed("iptables-mod-tproxy") then
		o:value("nil", translate("Disable"))
		o:value("same", translate("Same as Main Server"))
		for k, v in pairs(server_table) do o:value(k, v) end
	else
		o:value("nil", translate("Unusable - Missing iptables-mod-tproxy"))
	end
	o.default = "nil"
	o.rmempty = false

	o = s:option(Value, "local_port", translate("Local Port"))
	o.datatype = "port"
	o.default = 1234
	o.rmempty = false
end

-- [[ SOCKS5 Proxy ]]--
if has_local then
	s = m:section(TypedSection, "socks5_proxy", translate("SOCKS5 Proxy"))
	s.anonymous = true

	o = s:option(ListValue, "server", translate("Server"))
	o:value("nil", translate("Disable"))
	for k, v in pairs(server_table) do o:value(k, v) end
	o.default = "nil"
	o.rmempty = false

	o = s:option(Value, "local_port", translate("Local Port"))
	o.datatype = "port"
	o.default = 1080
	o.rmempty = false
end

-- [[ Port Forward ]]--
if has_tunnel then
	s = m:section(TypedSection, "port_forward", translate("Port Forward"))
	s.anonymous = true

	o = s:option(ListValue, "server", translate("Server"))
	o:value("nil", translate("Disable"))
	for k, v in pairs(server_table) do o:value(k, v) end
	o.default = "nil"
	o.rmempty = false

	o = s:option(Value, "local_port", translate("Local Port"))
	o.datatype = "port"
	o.default = 5300
	o.rmempty = false

	o = s:option(Value, "destination", translate("Destination"))
	o.default = "8.8.4.4:53"
	o.rmempty = false
end

return m
