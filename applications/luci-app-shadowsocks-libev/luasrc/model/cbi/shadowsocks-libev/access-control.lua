-- Copyright (C) 2016 Jian Chang <aa65535@live.com>
-- Licensed to the public under the GNU General Public License v3.

local m, s, o
local shadowsocks = "shadowsocks-libev"
local uci = luci.model.uci.cursor()
local nwm = require("luci.model.network").init()
local chnroute = uci:get_first("chinadns", "chinadns", "chnroute")

m = Map(shadowsocks, "%s - %s" %{translate("ShadowSocks"), translate("Access Control")})

-- [[ Zone WAN ]]--
s = m:section(TypedSection, "access_control", translate("Zone WAN"))
s.anonymous = true

o = s:option(Value, "wan_bp_list", translate("Bypassed IP List"))
o:value("/dev/null", translate("NULL - As Global Proxy"))
if chnroute then o:value(chnroute, translate("ChinaDNS CHNRoute")) end
o.datatype = "or(file, '/dev/null')"
o.default = chnroute or "/dev/null"
o.rmempty = false

o = s:option(DynamicList, "wan_bp_ips", translate("Bypassed IP"))
o.datatype = "ip4addr"
o.rmempty = true

o = s:option(DynamicList, "wan_fw_ips", translate("Forwarded IP"))
o.datatype = "ip4addr"
o.rmempty = true

-- [[ Zone LAN ]]--
s = m:section(TypedSection, "access_control", translate("Zone LAN"))
s.anonymous = true

o = s:option(MultiValue, "lan_ifaces", translate("Interface"))
for _, net in ipairs(nwm:get_networks()) do
	if net:name() ~= "loopback" and string.find(net:name(), "wan") ~= 1 then
		net = nwm:get_network(net:name())
		local device = net and net:get_interface()
		if device then
			o:value(device:name(), device:get_i18n())
		end
	end
end

o = s:option(ListValue, "lan_target", translate("Proxy Type"))
o:value("SS_SPEC_WAN_AC", translate("Normal"))
o:value("RETURN", translate("Direct"))
o:value("SS_SPEC_WAN_FW", translate("Global"))
o.rmempty = false

-- [[ LAN Hosts ]]--
s = m:section(TypedSection, "lan_hosts", translate("LAN Hosts"))
s.template  = "cbi/tblsection"
s.addremove = true
s.anonymous = true

o = s:option(Value, "host", translate("Host"))
luci.sys.net.ipv4_hints(function(ip, name)
	o:value(ip, "%s (%s)" %{ip, name})
end)
o.datatype = "ip4addr"
o.rmempty  = false

o = s:option(ListValue, "type", translate("Proxy Type"))
o:value("b", translatef("Direct"))
o:value("g", translatef("Global"))
o:value("n", translatef("Normal"))
o.rmempty  = false

o = s:option(Flag, "enable", translate("Enable"))
o.default = 1
o.rmempty = false

return m
