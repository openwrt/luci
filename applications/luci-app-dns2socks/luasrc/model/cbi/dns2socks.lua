--[[
--dns2socks configuration page. Made by 981213
--
]]--

local fs = require "nixio.fs"

m = Map("dns2socks", translate("DNS2Socks"),
        translatef("DNS2SOCKS is a command line utility running to forward DNS requests to a DNS server via a SOCKS tunnel."))

s = m:section(TypedSection, "dns2socks", translate("Settings"))
s.anonymous = true

switch = s:option(Flag, "enabled", translate("Enable"))
switch.rmempty = false

socksserver = s:option(Value, "socksserver", translate("Socks Server IP Address"), translate("Your Socks5 Server IP Address."))
socksserver.optional = false

socksport = s:option(Value, "socksport", translate("Socks Server Port"), translate("Your Socks5 Server Port."))
socksport.datatype = "range(0,65535)"
socksport.optional = false

dnsserver = s:option(Value, "dnsserver", translate("DNS Server IP Address"), translate("DNS server that DNS requests will be forwarded to."))
dnsserver.optional = false

localip = s:option(Value, "localip", translate("Local IP Address"), translate("IP address that DNS2SOCKS should listen to."))
localip.optional = false

localport = s:option(Value, "localport", translate("Local Port"), translate("The Port that DNS2SOCKS should listen to."))
localport.datatype = "range(0,65535)"
localport.optional = false


return m


