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

e = s:option(Value, "account", translate("Natcap Account"))
e.rmempty = true
e.placeholder = 'account'

e = s:option(DynamicList, "server", translate("Natcap Server"), translate("Specifying the natcap server address (ip:port)"))
e.datatype = "list(ipaddrport(1))"
e.placeholder = "1.2.3.4:0"

e = s:option(Flag, "enable_encryption", translate("Enable Encryption"))
e.default = e.enabled
e.rmempty = false

e = s:option(Flag, "client_forward_mode", translate("Client Forward Mode"), translate("Enable if use as router"))
e.default = e.enabled
e.rmempty = false

e = s:option(Flag, "clear_dst_on_reload", translate("Clear Dst On Reload"), translate("Enable if you want to clear dst on reload"))
e.default = e.disabled
e.rmempty = false

e = s:option(Value, "server_persist_timeout", translate("Server Persist Timeout(s)"), translate("Switch to diffrent server after timeout"))
e.default = '60'
e.rmempty = true
e.placeholder = '60'

e = s:option(Value, "debug", translate("Debug Mode Mask"), translate("Mask value for kernel debug print"))
e.default = '0'
e.rmempty = true
e.placeholder = '0'

e = s:option(Value, "dns_proxy_server", translate("DNS Proxy Server"))
e.rmempty = true
e.datatype = "ipaddrport(1)"
e.placeholder = "8.8.8.8:53"

return m
