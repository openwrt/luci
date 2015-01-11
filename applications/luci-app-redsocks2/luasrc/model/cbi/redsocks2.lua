--[[
RA-MOD
]]--

local fs = require "nixio.fs"

local running=(luci.sys.call("pidof redsocks2 > /dev/null") == 0)
if running then	
	m = Map("redsocks2", translate("redsocks2"), translate("redsocks2 is running"))
else
	m = Map("redsocks2", translate("redsocks2"), translate("redsocks2 is not running"))
end

s = m:section(TypedSection, "redsocks2", "")
s.anonymous = true

switch = s:option(Flag, "enabled", translate("Enable"))
switch.rmempty = false

localport = s:option(Value, "localport", translate("Local Port"))
localport.optional = false
localport.datatype = "range(0,65535)"

proxytype = s:option(ListValue, "proxytype", translate("Proxy Type"))
proxytype:value("direct")
proxytype:value("socks4")
proxytype:value("socks5")
proxytype:value("http-connect")
proxytype:value("http-relay")

autoproxy = s:option(Flag, "autoproxy", translate("AutoProxy"))
autoproxy.rmempty = false

timeout = s:option(Value, "timeout", translate("Timeout"))
timeout.optional = false

proxyip = s:option(Value, "proxyip", translate("Proxy IP"))
proxyip.optional = false

proxyport = s:option(Value, "proxyport", translate("Proxy Port"))
proxyport.optional = false
proxyport.datatype = "range(0,65535)"

blacklist_enable = s:option(Flag, "blacklist_enabled", translate("Bypass Lan IP"))
blacklist_enable.default = false

blacklist = s:option(TextValue, "blacklist", " ", "")
blacklist.template = "cbi/tvalue"
blacklist.size = 30
blacklist.rows = 10
blacklist.wrap = "off"
blacklist:depends("blacklist_enabled", 1)

function blacklist.cfgvalue(self, section)
	return fs.readfile("/etc/ipset/blacklist") or ""
end
function blacklist.write(self, section, value)
	if value then
		value = value:gsub("\r\n?", "\n")
		fs.writefile("/tmp/blacklist", value)
		fs.mkdirr("/etc/ipset")
		if (fs.access("/etc/ipset/blacklist") ~= true or luci.sys.call("cmp -s /tmp/blacklist /etc/ipset/blacklist") == 1) then
			fs.writefile("/etc/ipset/blacklist", value)
		end
		fs.remove("/tmp/blacklist")
	end
end

whitelist_enable = s:option(Flag, "whitelist_enabled", translate("Bypass IP Whitelist"))
whitelist_enable.default = false

whitelist = s:option(TextValue, "whitelist", " ", "")
whitelist.template = "cbi/tvalue"
whitelist.size = 30
whitelist.rows = 10
whitelist.wrap = "off"
whitelist:depends("whitelist_enabled", 1)

function whitelist.cfgvalue(self, section)
	return fs.readfile("/etc/ipset/whitelist") or ""
end
function whitelist.write(self, section, value)
	if value then
		value = value:gsub("\r\n?", "\n")
		fs.writefile("/tmp/whitelist", value)
		fs.mkdirr("/etc/ipset")
		if (fs.access("/etc/ipset/whitelist") ~= true or luci.sys.call("cmp -s /tmp/whitelist /etc/ipset/whitelist") == 1) then
			fs.writefile("/etc/ipset/whitelist", value)
		end
		fs.remove("/tmp/whitelist")
	end
end

return m
