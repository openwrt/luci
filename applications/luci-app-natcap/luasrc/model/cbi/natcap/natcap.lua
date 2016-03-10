-- Copyright 2008 Steven Barth <steven@midlink.org>
-- Copyright 2008-2011 Jo-Philipp Wich <jow@openwrt.org>
-- Licensed to the public under the Apache License 2.0.

local m = Map("natcapd", luci.util.pcdata(translate("Natcap")), translate("Natcap packet to avoid inspection"))

local s = m:section(TypedSection, "natcapd", "")
s.addremove = false
s.anonymous = true

local e = s:option(Flag, "_init", translate("Enable Natcap"))
e.rmempty  = false

function e.cfgvalue(self, section)
	return luci.sys.init.enabled("natcapd") and self.enabled or self.disabled
end

function e.write(self, section, value)
	if value == "1" then
		luci.sys.call("/etc/init.d/natcapd enable >/dev/null")
		luci.sys.call("/etc/init.d/natcapd start >/dev/null")
	else
		luci.sys.call("/etc/init.d/natcapd stop >/dev/null")
		luci.sys.call("/etc/init.d/natcapd disable >/dev/null")
	end
end

local lserver = nil
lserver = s:option(DynamicList, "server", translate("Natcap server (ip address)"), translate("Specifying the natcap server address"))
lserver.datatype = "list(ipaddr)"

local o = s:option(Flag, "client_forward_mode", translate("Client Forward Mode"), translate("Enable if use as router"))
o.default = o.enabled
o.rmempty = false

e = s:option(Value, "debug", translate("Debug Mode Mask"), translate("Mask value for kernel debug print"))
e.default = '0'
e.rmempty = true

dns = s:option(Value, "dns_proxy_server", translate("DNS Proxy Server"))
dns.optional = true
dns.rmempty = true
dns.datatype = "ipaddrport(1)"
dns.placeholder = "8.8.8.8:53"

return m
